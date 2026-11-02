// Disposable test database and local Next.js admin + Nest API only.
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const db = new PrismaClient();
const base = process.env.ADMIN_URL || 'http://127.0.0.1:3002';
if (!process.env.DATABASE_URL || !process.env.JWT_ACCESS_SECRET) throw Error('Test settings required');
async function req(path, method = 'GET', token, data) {
  const r = await fetch(base + path, {method, headers: {...(token ? {authorization: `Bearer ${token}`} : {}), ...(data ? {'content-type': 'application/json'} : {})}, ...(data ? {body: JSON.stringify(data)} : {})});
  let body = await r.text(); try { body = JSON.parse(body); } catch {}
  return {status:r.status, body, headers:r.headers};
}
function check(result, expected, name) {
  if (result.status !== expected) throw Error(`${name}: expected ${expected}, got ${result.status} ${JSON.stringify(result.body)}`);
  console.log('PASS', name, expected); return result.body;
}
(async () => {
  const a=randomUUID(),b=randomUUID(),tenants=[a,b],password='LocalOnly-Password-2026';
  try {
    await db.tenant.createMany({data:tenants.map(id=>({id}))});
    const role=await db.role.create({data:{tenantId:a,name:'editor',permissions:JSON.stringify(['titles:create'])}});
    const readonly=await db.role.create({data:{tenantId:a,name:'readonly',permissions:'[]'}});
    const hash=await argon2.hash(password,{type:argon2.argon2id});
    const staff=await db.staffUser.create({data:{tenantId:a,roleId:role.id,email:`${randomUUID()}@example.invalid`,passwordHash:hash}});
    const viewer=await db.staffUser.create({data:{tenantId:a,roleId:readonly.id,email:`${randomUUID()}@example.invalid`,passwordHash:hash}});
    const titleA=await db.title.create({data:{tenantId:a,kind:'MOVIE',titleAr:'أ',titleEn:'A',maturityRating:'PG'}});
    const titleB=await db.title.create({data:{tenantId:b,kind:'MOVIE',titleAr:'ب',titleEn:'B',maturityRating:'PG'}});
    check(await req('/api/admin/titles'),401,'anonymous title proxy denied');
    check(await req('/api/admin/login','GET'),405,'login method enforced');
    check(await req('/api/admin/login','POST',null,{email:staff.email,password:'wrong'}),401,'bad admin login');
    const userToken=jwt.sign({sub:staff.id},process.env.JWT_ACCESS_SECRET,{expiresIn:'5m'});
    check(await req('/api/admin/titles','GET',userToken),401,'user token denied');
    const result=await req('/api/admin/login','POST',null,{email:staff.email,password});
    const admin=check(result,200,'real admin login through proxy');
    if(result.headers.get('cache-control')!=='no-store') throw Error('login response may be cached');
    const list=check(await req('/api/admin/titles','GET',admin.accessToken),200,'list through proxy');
    if(!list.some(x=>x.id===titleA.id)||list.some(x=>x.id===titleB.id)) throw Error('tenant isolation failed');
    console.log('PASS proxy only lists current tenant');
    const readToken=check(await req('/api/admin/login','POST',null,{email:viewer.email,password}),200,'readonly login').accessToken;
    const data={kind:'MOVIE',titleAr:'اختبار',titleEn:'Proxy created',maturityRating:'PG',tenantId:b};
    check(await req('/api/admin/titles','POST',readToken,data),403,'readonly cannot create');
    const created=check(await req('/api/admin/titles','POST',admin.accessToken,data),201,'authorized create through proxy');
    if(created.tenantId!==a) throw Error('request changed tenant');
    console.log('PASS forged tenant ignored');
    check(await req('/api/admin/titles','PUT',admin.accessToken,{}),405,'unsupported method not stubbed');
  } finally {
    await db.title.deleteMany({where:{tenantId:{in:tenants}}});
    await db.staffUser.deleteMany({where:{tenantId:{in:tenants}}});
    await db.role.deleteMany({where:{tenantId:{in:tenants}}});
    await db.tenant.deleteMany({where:{id:{in:tenants}}}); await db.$disconnect();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
