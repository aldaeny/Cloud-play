import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as wait} from 'node:timers/promises';
export async function testSharedQuota(client,databaseUrl,check,clientPath,database){
 await check('round-robin HTTP load balancer and two independent native Prisma replicas share atomic quota; outage/retry/restart never reset allowance',async()=>{
  const children=[];let balancer;let stage='QUOTA_START';
  const worker=()=>new Promise((resolve,reject)=>{
   const child=fork(fileURLToPath(new URL('./test-shared-quota-worker.cjs',import.meta.url)),[],{env:{PATH:process.env.PATH,DATABASE_URL:databaseUrl+'?connect_timeout=2&pool_timeout=2',QUOTA_FIXTURE_CLIENT:clientPath,QUOTA_FIXTURE_WINDOW_MS:'60000'},stdio:['ignore','ignore','ignore','ipc']});children.push(child);
   const timer=setTimeout(()=>reject(new Error('QUOTA_WORKER_TIMEOUT')),15000);
   child.once('error',reject);child.once('exit',()=>reject(new Error('QUOTA_WORKER_EXITED')));child.once('message',m=>{clearTimeout(timer);resolve({child,port:m.port});});
  });
  const hit=(port,path='/auth/login',n=0)=>fetch(`http://127.0.0.1:${port}${path}`,{method:path==='/auth/login'?'POST':'GET',headers:{'x-forwarded-for':`203.0.113.${n%250}`,'x-country':'IQ'},signal:AbortSignal.timeout(15000)});
  try{
   // Align DB window away from its boundary without weakening quota assertions.
   const [{now}]=await client.$queryRaw`SELECT clock_timestamp() AS now`;
   const left=60000-(now.getTime()%60000);if(left<45000)await wait(left+30);
   const a=await worker(),b=await worker();
   // Real round-robin HTTP hop, not client-side alternating URLs. It forwards
   // spoofed XFF unchanged; the production middleware still uses only the peer.
   let turn=0;const routed=[0,0];
   balancer=createServer((req,res)=>{
    const index=turn++%2;routed[index]++;
    const upstream=httpRequest({host:'127.0.0.1',port:index?a.port:b.port,path:req.url,method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
    upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
   });
   await new Promise(resolve=>balancer.listen(0,'127.0.0.1',resolve));

   stage='QUOTA_RACE';const replies=await Promise.all(Array.from({length:30},(_,i)=>hit(balancer.address().port,'/auth/login',i)));
   assert.deepEqual(routed,[15,15]);
   assert.equal(replies.filter(r=>r.status===204).length,10);assert.equal(replies.filter(r=>r.status===429).length,20);
   assert.ok(replies.filter(r=>r.status===429).every(r=>Number(r.headers.get('retry-after'))>=1));
   stage='QUOTA_REPLICA_RESTART';a.child.send('stop');await new Promise(resolve=>a.child.once('exit',resolve));const restarted=await worker();
   assert.equal((await hit(restarted.port)).status,429);
   stage='QUOTA_COMBINED';const general=await Promise.all(Array.from({length:100},(_,i)=>hit(i%2?restarted.port:b.port,'/fixture',i)));
   assert.equal(general.filter(r=>r.status===204).length,90);assert.equal(general.filter(r=>r.status===429).length,10);
   // Actual authority outage, not a mock. Both separate processes must deny
   // rather than mint a local budget. Existing tokens are irrelevant here.
   stage='QUOTA_DB_OUTAGE';await database.stop();
   try{for(const port of [b.port,restarted.port]){const denied=await hit(port);assert.equal(denied.status,503);assert.equal((await denied.json()).code,'RATE_LIMIT_AUTHORITY_UNAVAILABLE');}}
   finally{await database.start();}
   // Retry after ambiguous store failure/recovery MUST NOT reset consumption.
   stage='QUOTA_DB_RECOVERY';for(const port of [b.port,restarted.port]){
    // A stale native connection may still fail closed after DB readiness. Retry
    // to a bounded recovery deadline; never accept204 or reset the allowance.
    let status=503;const deadline=performance.now()+15000;
    while(status===503&&performance.now()<deadline){status=(await hit(port)).status;if(status===503)await wait(100);}
    assert.equal(status,429);
   }
   // Parent observer also held a connection across the outage. Reconnect its
   // own pool before read-only evidence collection (no business write replay).
   await client.$disconnect();await client.$connect();
   stage='QUOTA_WINDOW_RESET';const [{now:resetNow}]=await client.$queryRaw`SELECT clock_timestamp() AS now`;
   await wait(60000-(resetNow.getTime()%60000)+50);
   assert.equal((await hit(b.port)).status,204);assert.equal((await hit(restarted.port)).status,204);
   // Expire only disposable quota rows (never Geo anchors), then prove pruning.
   await client.externalGeoNonce.updateMany({where:{id:{startsWith:'quota:'}},data:{expiresAt:new Date(0)}});
   const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
   const {PostgresRateLimiter}=require('../dist/common/shared-rate-limiter.js');
   await new PostgresRateLimiter(client).prune();assert.equal(await client.externalGeoNonce.count({where:{id:{startsWith:'quota:'}}}),0);
  }catch(error){error.code=stage;throw error;}finally{if(balancer){balancer.closeAllConnections();await new Promise(resolve=>balancer.close(resolve));}for(const child of children)if(child.exitCode===null&&child.signalCode===null){if(child.connected)child.send('stop');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),wait(3000)]);if(child.exitCode===null)child.kill('SIGKILL');}}
 });
}
