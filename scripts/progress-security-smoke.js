// Run only against a disposable local database and local API.
const { PrismaClient }=require('@prisma/client');
const jwt=require('jsonwebtoken'); const {randomUUID}=require('crypto');
const db=new PrismaClient(), base=process.env.API_URL || 'http://127.0.0.1:3100';
if(!process.env.JWT_ACCESS_SECRET)throw Error('JWT_ACCESS_SECRET required');
async function req(path,token,method='GET',body){const r=await fetch(base+path,{method,headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});let content=await r.text();try{content=JSON.parse(content)}catch{}return {status:r.status,body:content};}
function status(res,n,label){if(res.status!==n)throw Error(`${label} expected ${n}: ${res.status} ${JSON.stringify(res.body)}`);console.log('PASS',label,n)}
(async()=>{const tenant=randomUUID(),tenant2=randomUUID();try{
 await db.tenant.createMany({data:[{id:tenant},{id:tenant2}]});
 const u=await db.appUser.create({data:{tenantId:tenant,email:`${randomUUID()}@example.invalid`}});
 const other=await db.appUser.create({data:{tenantId:tenant,email:`${randomUUID()}@example.invalid`}});
 const profile=await db.profile.create({data:{userId:u.id,name:'test'}});const foreign=await db.profile.create({data:{userId:other.id,name:'other'}});
 const device=await db.device.create({data:{userId:u.id,platform:'web',deviceName:'test'}});
 const title=await db.title.create({data:{tenantId:tenant,kind:'MOVIE',state:'PUBLISHED',titleAr:'تجربة',titleEn:'Test',maturityRating:'PG'}});
 const foreignTitle=await db.title.create({data:{tenantId:tenant2,kind:'MOVIE',state:'PUBLISHED',titleAr:'تجربة',titleEn:'Foreign',maturityRating:'PG'}});
 const season=await db.season.create({data:{titleId:title.id,number:1}}); const episode=await db.episode.create({data:{titleId:title.id,seasonId:season.id,number:1,titleAr:'حلقة',titleEn:'Episode',state:'PUBLISHED'}});
 const session=await db.playbackSession.create({data:{userId:u.id,profileId:profile.id,deviceId:device.id,titleId:title.id}});
 const token=jwt.sign({sub:u.id,tenantId:tenant2,profiles:[foreign.id]},process.env.JWT_ACCESS_SECRET,{expiresIn:'5m'});const otherToken=jwt.sign({sub:other.id,tenantId:tenant,profiles:[profile.id]},process.env.JWT_ACCESS_SECRET,{expiresIn:'5m'});
 const payload={titleId:title.id,profileId:profile.id,positionSec:0};
 status(await req('/playback/me/progress',token,'PUT',payload),200,'movie position 0 accepted');
 status(await req('/playback/me/progress',token,'PUT',{...payload,positionSec:42}),200,'movie position updated');
 const reads=await req('/playback/me/progress',token);status(reads,200,'read own progress');if(reads.body.length!==1||reads.body[0].positionSec!==42)throw Error('movie progress not updated');
 const concurrent=await Promise.all(Array.from({length:6},(_,i)=>req('/playback/me/progress',token,'PUT',{...payload,positionSec:50+i})));if(concurrent.some(r=>r.status!==200))throw Error('concurrent progress update failed '+JSON.stringify(concurrent));
 const count=await db.watchProgress.count({where:{profileId:profile.id,titleId:title.id,episodeId:null}});if(count!==1)throw Error('duplicate movie progress');console.log('PASS concurrent movie updates remain unique');
 status(await req('/playback/me/progress',token,'PUT',{...payload,profileId:foreign.id}),403,'foreign profile denied');
 status(await req('/playback/me/progress',token,'PUT',{...payload,titleId:foreignTitle.id}),404,'foreign tenant title denied');
 status(await req('/playback/me/progress',token,'PUT',{...payload,episodeId:episode.id}),200,'episode progress created');
 status(await req('/playback/me/progress',token,'PUT',{...payload,episodeId:episode.id,positionSec:7}),200,'episode progress updated');
 status(await req(`/playback/sessions/${session.id}/heartbeat`,otherToken,'POST'),409,'foreign heartbeat denied');
 status(await req(`/playback/sessions/${session.id}/end`,otherToken,'POST'),409,'foreign session end denied');
 status(await req(`/playback/sessions/${session.id}/heartbeat`,token,'POST'),201,'owner heartbeat allowed');
 status(await req(`/playback/sessions/${session.id}/end`,token,'POST'),201,'owner session end allowed');
 }finally{await db.watchProgress.deleteMany({where:{profile:{user:{tenantId:tenant}}}});await db.playbackSession.deleteMany({where:{user:{tenantId:tenant}}});await db.episode.deleteMany({where:{title:{tenantId:tenant}}});await db.season.deleteMany({where:{title:{tenantId:tenant}}});await db.title.deleteMany({where:{tenantId:{in:[tenant,tenant2]}}});await db.device.deleteMany({where:{user:{tenantId:tenant}}});await db.profile.deleteMany({where:{user:{tenantId:tenant}}});await db.appUser.deleteMany({where:{tenantId:tenant}});await db.tenant.deleteMany({where:{id:{in:[tenant,tenant2]}}});await db.$disconnect();}})().catch(e=>{console.error(e);process.exitCode=1});
