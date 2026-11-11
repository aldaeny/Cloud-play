// Operator-only, original synthetic media; no external provider URLs or media fetches.
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const { S3Client, PutObjectCommand }=require('@aws-sdk/client-s3');
module.exports=async function demo(prisma) {
  if(process.env.SELFHOST_LOCAL_ONLY!=='true' || process.env.SUPABASE_URL!=='https://auth-gateway')throw new Error('LOCAL_DEMO_ONLY');
  if(!fs.existsSync('/synthetic/hls/master.m3u8'))throw new Error('GENERATE_ORIGINAL_FIXTURES_FIRST');
  const tenantId=process.env.DEFAULT_TENANT_ID;
  const email=`synthetic-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('hex');
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),body=Buffer.from(JSON.stringify({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60})).toString('base64url');
  const token=`${header}.${body}.`+createHmac('sha256',process.env.SUPABASE_JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  const response=await fetch('https://auth-gateway/auth/v1/admin/users',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true}),redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('LOCAL_AUTH_DEMO_CREATION_FAILED');
  const identity=await response.json();if(!/^[a-f0-9-]{36}$/i.test(identity.id||''))throw new Error('LOCAL_AUTH_ID_INVALID');
  const assetId=randomUUID();
  const s3=new S3Client({endpoint:process.env.STORAGE_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.STORAGE_ACCESS_KEY,secretAccessKey:process.env.STORAGE_SECRET_KEY}});
  for(const file of fs.readdirSync('/synthetic/hls')){
    const full=path.join('/synthetic/hls',file);
    if(!/^[a-zA-Z0-9_-]+\.(m3u8|ts|vtt)$/.test(file)||!fs.lstatSync(full).isFile()||fs.lstatSync(full).size>16*1024*1024)throw new Error('UNEXPECTED_SYNTHETIC_FIXTURE');
    await s3.send(new PutObjectCommand({Bucket:process.env.STORAGE_BUCKET,Key:`hls/${assetId}/${file}`,Body:fs.readFileSync(full),ContentType:file.endsWith('.m3u8')?'application/vnd.apple.mpegurl':file.endsWith('.vtt')?'text/vtt':'video/mp2t'}));
  }
  const result=await prisma.$transaction(async tx=>{
    const user=await tx.appUser.create({data:{id:identity.id,tenantId,email,profiles:{create:{name:'Synthetic customer demo',maturityMax:'PG-13'}}},include:{profiles:true}});
    const device=await tx.device.create({data:{userId:user.id,platform:'web',deviceName:'Synthetic demo browser'}});
    const title=await tx.title.create({data:{tenantId,kind:'MOVIE',state:'PUBLISHED',titleAr:'عرض صناعي أصلي — بدون محتوى خارجي',titleEn:'Original synthetic customer demo',maturityRating:'G',genres:['Synthetic'],runtimeSec:20}});
    await tx.rightsWindow.create({data:{titleId:title.id,contractRef:'Generated locally by scripts/generate-media-fixtures.mjs; no third-party content',territories:'["IQ"]',startsAt:new Date(),endsAt:new Date(Date.now()+7*86400000)}});
    await tx.mediaAsset.create({data:{id:assetId,titleId:title.id,ownerId:title.id,ownerType:'title',sourceKey:'synthetic-original-not-an-external-source',hlsManifestKey:`hls/${assetId}/master.m3u8`,status:'ACTIVE'}});
    const plan=await tx.plan.upsert({where:{tenantId_code:{tenantId,code:'internal-demo'}},update:{},create:{tenantId,code:'internal-demo',interval:'manual',priceCents:0,currency:'USD',maxStreams:1,maxDevices:2}});
    await tx.subscription.create({data:{userId:user.id,planId:plan.id,provider:'internal-manual',status:'ACTIVE',currentPeriodEnd:new Date(Date.now()+7*86400000)}});
    await tx.auditLog.create({data:{tenantId,actorId:tenantId,action:'synthetic.demo.created',entity:'Title',entityId:title.id,diff:{externalMedia:false,financial:false,auth:'operator-created-synthetic-only'}}});
    return {titleId:title.id,profileId:user.profiles[0].id,deviceId:device.id};
  });
  // The mounted output directory must be operator-private. No credentials in stdout.
  const output={email,password,...result,financial:false,rights:'original synthetic, seven-day local demo',identity:'real local GoTrue admin-created synthetic account; not email-delivery proof'};
  fs.writeFileSync('/demo-output/customer-demo.json',JSON.stringify(output,null,2),{flag:'wx',mode:0o600});
  console.log('PASS synthetic customer data imported. Read private .selfhost/demo/customer-demo.json locally; do not share credentials.');
};
