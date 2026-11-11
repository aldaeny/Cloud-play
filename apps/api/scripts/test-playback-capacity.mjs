// Bounded isolated measurements, NOT a production capacity/SLO certification.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),request=require('supertest');
export async function measurePlaybackCapacity({app,prisma,base,token,geo}){
 if(!process.env.AUTH_TEST_DATABASE_URL?.includes('127.0.0.1:5439'))throw new Error('ISOLATED_CAPACITY_DATABASE_REQUIRED');
 const samples={create:[],renew:[],segment:[]};let connections=0;
 const db=async()=>{
  const [row]=await prisma.$queryRaw`SELECT (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend') AS connections, pg_database_size(current_database()) AS bytes, pg_size_bytes(current_setting('shared_buffers')) AS shared_buffers, current_setting('max_connections')::int AS max_connections`;
  connections=Math.max(connections,row.connections);return row;
 };
 const before=await db();const channelId=base.split('/')[2];
 const call=(method,path,lease)=>request(app.getHttpServer())[method](path).set('Authorization',`Bearer ${token}`).set('x-playback-session',lease||'').set('x-external-geo',geo(channelId,token));
 let lease;
 try{
  for(let i=0;i<20;i++){
   const start=performance.now(),res=await call('post',base+'/session').set('x-external-geo',geo(channelId)).expect(201);samples.create.push(performance.now()-start);lease=res.body.id;
   await call('delete',base+'/session',lease).expect(200);lease=undefined;
  }
  lease=(await call('post',base+'/session').set('x-external-geo',geo(channelId)).expect(201)).body.id;
  for(let wave=0;wave<5;wave++)await Promise.all(Array.from({length:4},async()=>{const start=performance.now();await call('put',base+'/session',lease).set('x-external-geo',geo(channelId)).expect(200);samples.renew.push(performance.now()-start);await db();}));
  const text=async path=>(await call('get',path,lease).buffer(true).parse((res,done)=>{let value='';res.on('data',chunk=>value+=chunk.toString());res.on('end',()=>done(null,value));}).expect(200)).body;
  const master=await text(base+'/manifest'),variant=master.split('\n').find(line=>line.startsWith('/external-playback/'));
  const media=await text(variant),segment=media.split('\n').find(line=>line.startsWith('/external-playback/'));assert.ok(segment);
  for(let wave=0;wave<4;wave++)await Promise.all(Array.from({length:8},async()=>{const start=performance.now();const res=await call('get',segment,lease).expect(200);assert.match(res.headers['content-type'],/video\/mp2t/);assert.equal(res.headers['cache-control'],'private, no-store');assert.ok(res.body.length>188);samples.segment.push(performance.now()-start);await db();}));
  const after=await db();assert.ok(connections<before.max_connections);
  const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:values.length,mean_ms:+(values.reduce((a,b)=>a+b,0)/values.length).toFixed(3),p95_ms:+sorted[Math.ceil(sorted.length*.95)-1].toFixed(3),max_ms:+sorted.at(-1).toFixed(3)};};
  return {environment:'disposable-GoTrue-native-PostgreSQL-synthetic-TLS',certifies_production_capacity:false,concurrency:{renew:4,segment:8},create:stats(samples.create),renew:stats(samples.renew),segment:stats(samples.segment),database:{observed_client_connections_max:connections,max_connections_setting:before.max_connections,size_bytes_before:Number(before.bytes),size_bytes_after:Number(after.bytes),shared_buffers_setting_bytes:Number(before.shared_buffers)},node_rss_bytes:process.memoryUsage().rss};
 }finally{if(lease)await call('delete',base+'/session',lease).expect(200);}
}
