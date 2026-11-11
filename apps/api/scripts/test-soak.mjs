import assert from 'node:assert/strict';
import {freemem} from 'node:os';
import {setTimeout as wait} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
/** Candidate SLO for this isolated workload only, NOT an approved production SLO. */
export async function soak({users,call,base,prisma,stats}){
 const duration=Number(process.env.ISOLATED_SOAK_MS);
 assert.ok(Number.isInteger(duration)&&duration>=600000&&duration<=3600000);
 const dbUrl=new URL(process.env.AUTH_TEST_DATABASE_URL||'http://invalid');assert.equal(dbUrl.hostname,'127.0.0.1');assert.equal(dbUrl.port,'5439');
 const active=users.slice(0,5),latency=[],samples=[];let requests=0,errors=0,timeouts=0,bytes=0,flows=0,failedFlows=0;
 const connections=async()=>Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend'`)[0].n);
 const initialConnections=await connections();
 const started=performance.now(),cpu=process.cpuUsage();let renewAt=0,sampleAt=0;
 const request=async(task)=>{const t=performance.now();requests++;try{const r=await task();if(r.status!==200&&r.status!==201)throw new Error('HTTP_STATUS');bytes+=typeof r.body==='string'?Buffer.byteLength(r.body):Buffer.isBuffer(r.body)?r.body.length:Buffer.byteLength(JSON.stringify(r.body||{}));return r;}catch(e){errors++;if(e.timeout||e.name==='TimeoutError')timeouts++;throw e;}finally{latency.push(performance.now()-t);}};
 const text=(u,url)=>call(u,'get',url).buffer(true).parse((res,done)=>{let value='';res.on('data',b=>value+=b.toString());res.on('end',()=>done(null,value));});
 try{
  for(const u of active){const r=await call(u,'post',base+'/session').expect(201);u.lease=r.body.id;}
  while(performance.now()-started<duration){
   const wave=performance.now();assert.ok(process.memoryUsage().rss<768*1024**2,'SOAK_RSS_SAFETY');assert.ok(freemem()>256*1024**2,'SOAK_HOST_MEMORY_SAFETY');
   if(wave>=renewAt){await Promise.all(active.map(u=>request(()=>call(u,'put',base+'/session').expect(200))));renewAt=performance.now()+30000;}
   const outcomes=await Promise.allSettled(active.map(async u=>{
    const master=(await request(()=>text(u,base+'/manifest'))).body;
    const variant=master.split('\n').find(x=>x.startsWith('/external-playback/'));assert.ok(variant);
    const media=(await request(()=>text(u,variant))).body;
    const segment=media.split('\n').find(x=>x.startsWith('/external-playback/'));assert.ok(segment);
    await request(()=>call(u,'get',segment));
   }));
   flows+=outcomes.length;failedFlows+=outcomes.filter(r=>r.status==='rejected').length;
   if(wave>=sampleAt){samples.push({elapsed_ms:Math.round(wave-started),rss_bytes:process.memoryUsage().rss,db_connections:await connections()});sampleAt=performance.now()+5000;}
   await wait(Math.max(0,1000-(performance.now()-wave)));
  }
  const elapsed=performance.now()-started,used=process.cpuUsage(cpu),lat=stats(latency),recovery=performance.now();await prisma.$queryRaw`SELECT 1`;
  const result={status:'PASS',scope:'600s+ isolated real GoTrue/native PG/Nest/TLS, five viewers; not production ingress or devices',duration_ms:Math.round(elapsed),requests,flows,failed_flows:failedFlows,throughput_rps:+(requests/(elapsed/1000)).toFixed(3),error_rate:errors/requests,timeout_rate:timeouts/requests,response_bytes:bytes,latency:lat,process_cpu_ms:(used.user+used.system)/1000,samples,recovery_query_ms:+(performance.now()-recovery).toFixed(3),initial_db_connections:initialConnections,recovery_db_connections:await connections(),slo:{status:'candidate fixture SLO only; production approval BLOCKED',p95_ms:2000,p99_ms:5000,error_rate_max:0.01,timeout_rate_max:0,throughput_rps_min:5},limitations:['five synthetic viewers; not physical decoders','main.ts ingress/distributed quota excluded','process CPU/RSS not DB IO/CPU','ten minutes not hours/days stability proof']};
  const ok=failedFlows/Math.max(1,flows)<=0.01&&lat.p95_ms<=2000&&lat.p99_ms<=5000&&result.error_rate<=0.01&&result.timeout_rate===0&&result.throughput_rps>=5&&result.recovery_db_connections<=initialConnections+5;
  if(!ok)result.status='FAIL';await writeFile('soak-evidence.json',JSON.stringify(result,null,2));console.log('::notice title=Isolated ten-minute soak::'+JSON.stringify(result));assert.ok(ok,'SOAK_CANDIDATE_SLO_FAILED');return result;
 }finally{for(const u of active){await call(u,'delete',base+'/session').expect(200);u.lease=undefined;}}
}
