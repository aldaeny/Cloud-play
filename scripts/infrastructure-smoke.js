// Run against disposable local services only; no production data or payments.
const { PrismaClient } = require('@prisma/client');
const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const { randomUUID } = require('crypto');
const { StorageService } = require('../apps/api/dist/common/storage.service');

async function database() {
  const db = new PrismaClient(); const tenantId = randomUUID();
  try {
    await db.tenant.create({data:{id:tenantId}});
    const user=await db.appUser.create({data:{tenantId,email:`${tenantId}@example.invalid`}});
    const title=await db.title.create({data:{tenantId,kind:'MOVIE',titleAr:'تجربة',titleEn:'Test',maturityRating:'PG'}});
    const plan=await db.plan.create({data:{tenantId,code:'test',interval:'month',priceCents:0,currency:'USD',maxStreams:1,maxDevices:1}});
    const subscription=await db.subscription.create({data:{userId:user.id,planId:plan.id,status:'ACTIVE',currentPeriodEnd:new Date(Date.now()+86400000),provider:'test'}});
    if (!(await db.subscription.findUnique({where:{id:subscription.id}})) || !(await db.title.findUnique({where:{id:title.id}}))) throw Error('readback failed');
    console.log('PASS database creates and reads user, title, subscription');
    await db.subscription.delete({where:{id:subscription.id}}); await db.plan.delete({where:{id:plan.id}}); await db.title.delete({where:{id:title.id}}); await db.appUser.delete({where:{id:user.id}}); await db.tenant.delete({where:{id:tenantId}});
  } finally { await db.$disconnect(); }
}
async function queueTest() {
 const connection=new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
 const name='integration-'+randomUUID(); const queue=new Queue(name,{connection}); const events=new QueueEvents(name,{connection});
 const worker=new Worker(name,async job=>{if(job.name==='retry' && job.attemptsMade===0)throw Error('expected transient failure'); if(job.name==='failed')throw Error('expected permanent failure'); return 'ok'},{connection});
 try {await events.waitUntilReady();const retry=await queue.add('retry',{}, {attempts:2,backoff:{type:'fixed',delay:100}});if(await retry.waitUntilFinished(events,10000)!=='ok')throw Error('retry did not succeed');const failed=await queue.add('failed',{}, {attempts:2,backoff:{type:'fixed',delay:100}});try {await failed.waitUntilFinished(events,10000);throw Error('failed job unexpectedly succeeded');} catch(e) {if(!String(e.message).includes('expected permanent failure'))throw e;} console.log('PASS Redis BullMQ retry and failed jobs');} finally {await worker.close();await events.close();await queue.obliterate({force:true});await queue.close();await connection.quit();}
}
async function storage() {const s=new StorageService();let key='smoke/'+randomUUID()+'.txt';const signed=await s.getPresignedUploadUrl(key,'text/plain',120);let r=await fetch(signed.uploadUrl,{method:'PUT',headers:{'content-type':'text/plain'},body:'smoke'});if(!r.ok)throw Error('signed upload: '+r.status+' '+await r.text());const data=await s.downloadFile(key);if(data.toString()!=='smoke')throw Error('storage mismatch');const url=await s.getPresignedDownloadUrl(key,120);r=await fetch(url.downloadUrl);if(!r.ok || await r.text()!=='smoke')throw Error('signed download failed');console.log('PASS SDK storage PUT and GET against local S3-compatible test server (not a privacy test)');}
(async()=>{await database();await queueTest();await storage()})().catch(e=>{console.error(e);process.exitCode=1});
