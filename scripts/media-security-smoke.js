// Disposable database and S3 service only. Never run with production secrets or data.
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const { randomUUID } = require('crypto');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const db = new PrismaClient();
const base = process.env.API_URL || 'http://127.0.0.1:3100';
const secret = process.env.ADMIN_JWT_SECRET;
if (!secret || !process.env.DATABASE_URL || !process.env.STORAGE_ENDPOINT) throw Error('Missing test settings');
async function request(path, token, method = 'GET', data) {
  const r = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(data ? {'content-type':'application/json'} : {}) }, ...(data ? {body:JSON.stringify(data)} : {}) });
  const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status:r.status, body };
}
function expectStatus(response, status, label) { if (response.status !== status) throw Error(`${label}: expected ${status}, got ${response.status}: ${JSON.stringify(response.body)}`); console.log('PASS', label, status); }
(async () => {
  const tenantA = randomUUID(), tenantB = randomUUID(); let key;
  const s3 = new S3Client({endpoint:process.env.STORAGE_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.STORAGE_ACCESS_KEY,secretAccessKey:process.env.STORAGE_SECRET_KEY}});
  try {
    await db.tenant.createMany({data:[{id:tenantA},{id:tenantB}]});
    const roleA = await db.role.create({data:{tenantId:tenantA,name:'editor',permissions:JSON.stringify(['titles:edit'])}});
    const roleB = await db.role.create({data:{tenantId:tenantB,name:'editor',permissions:JSON.stringify(['titles:edit'])}});
    const roleNo = await db.role.create({data:{tenantId:tenantA,name:'readonly',permissions:'[]'}});
    const password='LocalTestOnly-2026';
    const passwordHash=await argon2.hash(password,{type:argon2.argon2id});
    const staff = async (tenantId,roleId) => db.staffUser.create({data:{tenantId,roleId,email:`${randomUUID()}@example.invalid`,passwordHash}});
    const a=await staff(tenantA,roleA.id),b=await staff(tenantB,roleB.id),no=await staff(tenantA,roleNo.id);
    const tA=await db.title.create({data:{tenantId:tenantA,kind:'MOVIE',titleAr:'اختبار',titleEn:'Test A',maturityRating:'PG'}});
    const tB=await db.title.create({data:{tenantId:tenantB,kind:'MOVIE',titleAr:'اختبار',titleEn:'Test B',maturityRating:'PG'}});
    expectStatus(await request('/auth/admin/login',null,'POST',{email:a.email,password:'wrong'}),401,'wrong password denied');
    const token = async staffUser => {const result=await request('/auth/admin/login',null,'POST',{email:staffUser.email,password});expectStatus(result,200,'admin login');return result.body.accessToken;};
    const ta=await token(a),tb=await token(b),tn=await token(no);
    const notAdmin=jwt.sign({sub:a.id},secret,{expiresIn:'5m'});
    expectStatus(await request('/media/upload-url',notAdmin,'POST',{contentType:'video/mp4'}),401,'non-admin token rejected even with same secret');
    expectStatus(await request('/media/assets?ownerId=invalid',ta),400,'invalid owner ID rejected');
    const payload={contentType:'video/mp4'};
    expectStatus(await request('/media/upload-url',null,'POST',payload),401,'anonymous upload denied');
    expectStatus(await request('/media/upload-url',tn,'POST',payload),403,'missing permission denied');
    expectStatus(await request('/admin/users/00000000-0000-0000-0000-000000000099/status',tn,'PUT',{status:'active'}),403,'admin permission metadata enforced');
    const url = await request('/media/upload-url',ta,'POST',payload); expectStatus(url,201,'authorized upload URL'); key=url.body.objectKey;
    expectStatus(await request('/media/confirm',ta,'POST',{objectKey:key,ownerType:'title',ownerId:tA.id}),400,'confirmation rejects nonexistent object');
    const upload=await fetch(url.body.uploadUrl,{method:'PUT',headers:{'content-type':'video/mp4'},body:Buffer.from('test only')});if(!upload.ok)throw Error(`upload failed: ${upload.status}`);
    expectStatus(await request('/media/confirm',ta,'POST',{objectKey:key,ownerType:'title',ownerId:tB.id}),404,'cross-tenant owner denied');
    expectStatus(await request('/media/confirm',tb,'POST',{objectKey:key,ownerType:'title',ownerId:tB.id}),400,'other staff upload key denied');
    const confirm=await request('/media/confirm',ta,'POST',{objectKey:key,ownerType:'title',ownerId:tA.id});expectStatus(confirm,201,'authorized confirmation');
    const id=confirm.body.asset.id;
    expectStatus(await request(`/media/assets/${id}`,ta),200,'owner tenant can read');
    expectStatus(await request(`/media/assets/${id}`,tb),404,'other tenant cannot read');
    expectStatus(await request(`/media/assets/${id}`,tb,'DELETE'),404,'other tenant cannot delete');
  } finally {
    if(key) await s3.send(new DeleteObjectCommand({Bucket:process.env.STORAGE_BUCKET,Key:key}));
    const assets=await db.mediaAsset.findMany({where:{OR:[{title:{tenantId:tenantA}},{title:{tenantId:tenantB}}]},select:{id:true}});
    await db.transcodeJob.deleteMany({where:{mediaAssetId:{in:assets.map(a=>a.id)}}});
    await db.mediaAsset.deleteMany({where:{id:{in:assets.map(a=>a.id)}}});
    await db.title.deleteMany({where:{tenantId:{in:[tenantA,tenantB]}}});
    await db.staffUser.deleteMany({where:{tenantId:{in:[tenantA,tenantB]}}});
    await db.role.deleteMany({where:{tenantId:{in:[tenantA,tenantB]}}});
    await db.tenant.deleteMany({where:{id:{in:[tenantA,tenantB]}}});
    await db.$disconnect();
  }
})().catch(e=>{console.error(e);process.exitCode=1});
