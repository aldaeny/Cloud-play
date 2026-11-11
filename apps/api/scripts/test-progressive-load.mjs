// Actual isolated GoTrue identities -> Nest/Prisma -> controlled TLS media.
// Synthetic users only. In-process Nest harness excludes production ingress
// and main.ts IP middleware; NOT production capacity or distributed-rate proof.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHmac,randomUUID} from 'node:crypto';
import {freemem} from 'node:os';
import {setTimeout as wait} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),request=require('supertest');
export async function progressiveLoad({app,prisma,tenant,base,geo}){
 const url=new URL(process.env.AUTH_TEST_DATABASE_URL||'http://invalid');
 assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'5439');
 const users=[],phases=[],started=performance.now();let checkpoint='initial';let maxRss=0,minFree=Infinity;
 const safety=()=>{maxRss=Math.max(maxRss,process.memoryUsage().rss);minFree=Math.min(minFree,freemem());assert.ok(maxRss<768*1024**2,'RSS safety stop');assert.ok(minFree>256*1024**2,'free memory safety stop');assert.ok(performance.now()-started<240000,'total duration safety stop');};
 const adminToken=()=>{const adminPart=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({role:'service_role',aud:'authenticated',exp:Math.floor(Date.now()/1000)+600})).toString('base64url');
 return adminPart+'.'+createHmac('sha256','isolated-fixture-signing-key-not-for-any-production-use').update(adminPart).digest('base64url');};
 const auth=async(path,body,bearer)=>{
  const t=performance.now();const r=await fetch('http://127.0.0.1:9999'+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)});
  assert.equal(r.status,200,'isolated Auth response');return {data:await r.json(),ms:performance.now()-t};
 };
 const stats=a=>{const b=[...a].sort((x,y)=>x-y),p=n=>+(b[Math.max(0,Math.ceil(b.length*n)-1)]||0).toFixed(3);return {count:a.length,p50_ms:p(.5),p95_ms:p(.95),p99_ms:p(.99)};};
 const db=async()=>{const [row]=await prisma.$queryRaw`SELECT count(*)::int AS connections FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend'`;return row.connections;};
 const initialConnections=await db();
 // Keep one listening server for the whole measurement. Supertest's automatic
 // per-request listen/close lifecycle races when many temporary agents share
 // a non-listening Nest server, producing harness errors instead of HTTP data.
 const server=app.getHttpServer();
 if(!server.listening)await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const settle=async tasks=>{const results=await Promise.allSettled(tasks);const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;return results;};
 const channel=base.split('/')[2];
 const call=(u,method,path)=>request(app.getHttpServer())[method](path).timeout({response:10000,deadline:15000}).set('Authorization','Bearer '+u.token).set('x-playback-session',u.lease||'').set('x-external-geo',geo(channel,u.token));
 try{
  for(const count of [10,25,50,100]){
   checkpoint='provision_'+count;safety();const login=[];
   while(users.length<count){
    await Promise.all(Array.from({length:Math.min(5,count-users.length)},async()=>{
     const email='load-'+randomUUID()+'@example.invalid',password=randomUUID()+'Aa1!';
     const created=await auth('/admin/users',{email,password,email_confirm:true},adminToken()),u={id:created.data.id};users.push(u);
     await prisma.appUser.create({data:{id:u.id,tenantId:tenant,status:'active'}});
     const signed=await auth('/token?grant_type=password',{email,password});u.token=signed.data.access_token;login.push(signed.ms);
    }));safety();
   }
   checkpoint='requests_'+count;const phaseStart=performance.now(),cpu=process.cpuUsage(),samples={login,create:[],renew:[],channels:[],manifest:[],segment:[]};let errors=0,timeouts=0,total=0,connections=0,responseBytes=0;
   const timed=async(kind,fn)=>{const t=performance.now();total++;try{const value=await fn();if(typeof value==='string')responseBytes+=Buffer.byteLength(value);else if(Buffer.isBuffer(value?.body))responseBytes+=value.body.length;else if(value?.body)responseBytes+=Buffer.byteLength(JSON.stringify(value.body));return value;}catch(e){errors++;if(e.timeout||e.name==='TimeoutError')timeouts++;throw e;}finally{samples[kind].push(performance.now()-t);}};
   checkpoint='create_'+count;await settle(users.map(async u=>{
    const r=await timed('create',()=>call(u,'post',base+'/session').set('x-external-geo',geo(channel,u.token)).expect(201));u.lease=r.body.id;
   }));
   // Three timed waves with a 2s pause: bounded sustained bursts, not a soak.
   for(let wave=0;wave<3;wave++){
    checkpoint='wave_'+count+'_'+wave;safety();connections=Math.max(connections,await db());
    await settle(users.map(async u=>{
     await timed('renew',()=>call(u,'put',base+'/session').set('x-external-geo',geo(channel,u.token)).expect(200));
     await timed('channels',()=>call(u,'get','/profiles').expect(200)); // real authenticated API read; channel list is a Web path, not this API
     const text=async path=>(await call(u,'get',path).buffer(true).parse((res,done)=>{let value='';res.on('data',b=>value+=b.toString());res.on('end',()=>done(null,value));}).expect(200)).body;
     const master=await timed('manifest',()=>text(base+'/manifest'));
     const variant=master.split('\n').find(line=>line.startsWith('/external-playback/'));assert.ok(variant);
     const media=await text(variant),segment=media.split('\n').find(line=>line.startsWith('/external-playback/'));assert.ok(segment);
     await timed('segment',()=>call(u,'get',segment).expect(200));
    }));await wait(2000);
   }
   checkpoint='revoke_'+count;await settle(users.map(async u=>{await call(u,'delete',base+'/session').expect(200);u.lease=undefined;}));
   const used=process.cpuUsage(cpu);safety();
   phases.push({status:'PASS',users:count,duration_ms:Math.round(performance.now()-phaseStart),waves:3,requests_measured:total,response_bytes_measured:responseBytes,error_rate:errors/total,timeout_rate:timeouts/total,latency:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k==='channels'?'authenticated_profiles_api':k,stats(v)])),process_cpu_ms:(used.user+used.system)/1000,rss_bytes:process.memoryUsage().rss,observed_db_connections_max:connections});
  }
  checkpoint='recovery';await wait(2000);const recoveryStart=performance.now();await prisma.$queryRaw`SELECT 1`;const recoveryQueryMs=performance.now()-recoveryStart;const recoveryConnections=await db();assert.ok(recoveryConnections<=initialConnections+5,'connection recovery budget');
  const result={status:'PASS',scope:'synthetic isolated GoTrue/native PG/Nest/controlled TLS; main.ts ingress middleware excluded',certifies_production_capacity:false,phases,safety_limits:{rss_bytes:768*1024**2,min_free_bytes:256*1024**2,total_ms:240000,request_deadline_ms:15000},max_rss_bytes:maxRss,min_free_bytes:minFree,initial_db_connections:initialConnections,recovery_db_connections:recoveryConnections,recovery_query:'PASS',recovery_query_ms:+recoveryQueryMs.toFixed(3),limitations:['three sustained bursts per level, not long soak','process CPU/RSS not DB CPU/IO/RSS','authenticated profiles API read is not Web channel-directory load','all users same controlled tenant/stream; no physical concurrent decoders','no production ingress/distributed rate limit certification','observed connection count is not internal Prisma queue saturation telemetry']};
  if(process.env.ISOLATED_SOAK_MS){const {soak}=await import('./test-soak.mjs');await soak({users,call,base,prisma,stats});}
  await writeFile('progressive-load-evidence.json',JSON.stringify(result,null,2)+'\n');console.log('::notice title=Progressive synthetic load::'+JSON.stringify(result));return result;
 }catch(error){
  const code=typeof error?.code==='string'&&/^[A-Z0-9_]{1,32}$/.test(error.code)?error.code:'LOAD_CHECK_FAILED';
  const result={status:'FAILED',checkpoint,code,completed_phases:phases,created_users:users.length,error_type:['AssertionError','TypeError','Error','TimeoutError'].includes(error?.name)?error.name:'Error',actual:typeof error?.actual==='number'?error.actual:null,expected:typeof error?.expected==='number'?error.expected:null,timeout_ms:typeof error?.timeout==='number'?error.timeout:null,http_status:typeof error?.status==='number'?error.status:null,expected_got:String(error?.message||'').match(/expected (\d{3})[^\n]*got (\d{3})/)?.slice(1)||null,known_reason:['Server is not running','ECONNRESET','ECONNREFUSED','socket hang up','RSS safety stop','free memory safety stop','total duration safety stop','connection recovery budget'].find(text=>String(error?.message||'').includes(text))||null};
  await writeFile('progressive-load-evidence.json',JSON.stringify(result,null,2)+'\n');console.log('LOAD_FAILURE '+JSON.stringify(result));throw error;
 }finally{
  // Disposable identities only. Never print tokens, emails or passwords.
  for(const u of users){
   await prisma.externalPlaybackLease.deleteMany({where:{userId:u.id}});await prisma.appUser.deleteMany({where:{id:u.id}});
   const r=await fetch('http://127.0.0.1:9999/admin/users/'+u.id,{method:'DELETE',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+adminToken()}});assert.ok(r.ok);
  }
 }
}
