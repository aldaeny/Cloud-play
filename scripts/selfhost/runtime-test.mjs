// Executes the shipped lifecycle CLI against disposable real Compose services.
// Never accepts a production URL. Does not stand in for a hosted Auth/device test.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnvironment } from './policy.mjs';
const run=(cmd,args,opts={})=>execFileSync(cmd,args,{maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe'],...opts}).toString().trim();
const sha=run('git',['rev-parse','HEAD']),source='cloudplay-local-source',target='cloudplay-local-restored';
const dir=mkdtempSync(path.join(tmpdir(),'cloudplay-selfhost-')),archive=path.join(dir,'snapshot');
const base=['compose','--env-file','.env','-f','infra/docker/compose.yml','-f','infra/docker/compose.local.yml','-f','infra/docker/compose.selfhost.yml'];
const env={...process.env,SELFHOST_RELEASE:sha,BOOTSTRAP_ADMIN_EMAIL:'operator@synthetic.invalid',BOOTSTRAP_ADMIN_PASSWORD:randomBytes(24).toString('hex')};
const compose=(project,args)=>run('docker',[...base,'--project-name',project,...args],{env});
const cli=(action,project,extra=[])=>run(process.execPath,['scripts/selfhost/cli.mjs',action,project,sha,...extra],{env});
const checks=[];
const pass=name=>{checks.push(name);console.log('PASS '+name);};
let ownedEnv=false;
try {
  if(existsSync('.env'))throw new Error('Fixture refuses an existing environment file');
  run(process.execPath,['scripts/selfhost/init.mjs']);ownedEnv=true;
  let config=readFileSync('.env','utf8');config=/^VOD_DELIVERY_ENABLED=/m.test(config)?config.replace(/^VOD_DELIVERY_ENABLED=.*$/m,'VOD_DELIVERY_ENABLED="true"'):config+'\nVOD_DELIVERY_ENABLED="true"\n';writeFileSync('.env',config);
  // Avoid collisions with the other isolated runtime job. No host-service ports needed.
  console.log(cli('install',source));
  console.log(cli('health',source));
  pass('actual package builds and installs API/worker/web/admin/storage/database; native migrations and unique first-admin bootstrap');
  assert.throws(()=>cli('install',source));
  assert.throws(()=>compose(source,['run','--rm','--no-deps','-e','BOOTSTRAP_ADMIN_EMAIL','-e','BOOTSTRAP_ADMIN_PASSWORD','tools','bootstrap']));
  pass('repeat install/bootstrap refuse existing data and never reset admin credentials');
  mkdirSync('.cache/media-fixtures',{recursive:true});
  compose(source,['exec','-T','worker-media','mkdir','-p','/tmp/synthetic/hls']);
  compose(source,['exec','-T','worker-media','ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-t','2','-an','-c:v','libx264','-threads','1','-preset','ultrafast','-pix_fmt','yuv420p','-f','hls','-hls_time','1','-hls_playlist_type','vod','/tmp/synthetic/hls/master.m3u8']);
  const worker=compose(source,['ps','-q','worker-media']);
  run('docker',['cp',`${worker}:/tmp/synthetic/hls`,'.cache/media-fixtures/']);
  console.log(cli('demo-import',source));
  const demo=JSON.parse(readFileSync('.selfhost/demo/customer-demo.json'));
  const apiScript="const fs=require('fs');const x=JSON.parse(fs.readFileSync(0,'utf8'));fetch(x.url,{method:x.method||'GET',headers:x.headers||{},...(x.body?{body:JSON.stringify(x.body)}:{}),redirect:'error'}).then(async r=>{const bytes=Buffer.from(await r.arrayBuffer());console.log(JSON.stringify({status:r.status,mime:r.headers.get('content-type'),sha256:require('crypto').createHash('sha256').update(bytes).digest('hex'),text:bytes.toString('utf8'),length:bytes.length}));}).catch(()=>process.exit(1))";
  const apiFetch=(project,input)=>JSON.parse(run('docker',[...base,'--project-name',project,'exec','-T','api','node','-e',apiScript],{env,input:JSON.stringify(input)}));
  const login=apiFetch(source,{url:'https://auth-gateway/auth/v1/token?grant_type=password',method:'POST',headers:{'Content-Type':'application/json'},body:{email:demo.email,password:demo.password}});
  assert.equal(login.status,200);
  const access=JSON.parse(login.text).access_token;
  assert.ok(access);
  const localConfig=parseEnvironment(readFileSync('.env','utf8'));
  const signedGeo=()=>{const value=Buffer.from(JSON.stringify({channelId:`vod:${demo.titleId}`,tokenHash:createHash('sha256').update(access).digest('hex'),country:'IQ',platform:'web',issuedAt:Date.now(),expiresAt:Date.now()+30000,nonce:randomUUID()})).toString('base64url');return value+'.'+createHmac('sha256',localConfig.EXTERNAL_GEO_SIGNING_KEY).update(value).digest('base64url');};
  const vodHeaders=()=>({Authorization:`Bearer ${access}`,'Content-Type':'application/json','x-external-geo':signedGeo()});
  const created=apiFetch(source,{url:'http://127.0.0.1:3000/playback/sessions',method:'POST',headers:vodHeaders(),body:{titleId:demo.titleId,profileId:demo.profileId,deviceId:demo.deviceId}});
  assert.equal(created.status,201);
  const session=JSON.parse(created.text);
  const vodManifest=apiFetch(source,{url:'http://127.0.0.1:3000'+session.manifestUrl,headers:vodHeaders()});
  assert.equal(vodManifest.status,200);
  const segmentPath=vodManifest.text.split('\n').find(s=>s.startsWith('/playback/'));
  assert.ok(segmentPath);
  const actualSegment=apiFetch(source,{url:'http://127.0.0.1:3000'+segmentPath,headers:vodHeaders()});
  assert.equal(actualSegment.status,200);assert.ok(actualSegment.length>188);
  pass('real local GoTrue login/TLS + native API + private MinIO + generated FFmpeg VOD manifest/segment; Geo assertion is explicitly synthetic');
  async function databaseSnapshot(p) {
    const hash=require('crypto').createHash('sha256');
    const tables=await p.$queryRawUnsafe("SELECT schemaname,tablename,rowsecurity FROM pg_tables WHERE schemaname IN ('public','auth') ORDER BY 1,2");
    const quote=value=>'"'+value.replaceAll('"','""')+'"';
    for(const table of tables){
      const rows=await p.$queryRawUnsafe('SELECT row_to_json(t)::text AS value FROM '+quote(table.schemaname)+'.'+quote(table.tablename)+' t ORDER BY row_to_json(t)::text');
      hash.update(JSON.stringify([table,rows]));
    }
    for(const sql of ["SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','auth') ORDER BY 1,2,3", "SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','auth') ORDER BY 1,2,3", "SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.table_privileges WHERE table_schema IN ('public','auth') ORDER BY 1,2,3,4"]){hash.update(JSON.stringify(await p.$queryRawUnsafe(sql)));}
    return hash.digest('hex');
  }
  const payload={objectKey:`synthetic/${randomUUID()}.txt`,bytes:randomBytes(1024).toString('base64')};
  const probe=`const {PrismaClient}=require('@prisma/client');const {S3Client,PutObjectCommand,GetObjectCommand}=require('@aws-sdk/client-s3');const fs=require('fs');const p=new PrismaClient();const s=new S3Client({endpoint:process.env.STORAGE_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.STORAGE_ACCESS_KEY,secretAccessKey:process.env.STORAGE_SECRET_KEY}});(async()=>{const x=JSON.parse(fs.readFileSync(0,'utf8'));if(x.write)await s.send(new PutObjectCommand({Bucket:process.env.STORAGE_BUCKET,Key:x.objectKey,Body:Buffer.from(x.bytes,'base64'),ContentType:'text/plain'}));const body=await s.send(new GetObjectCommand({Bucket:process.env.STORAGE_BUCKET,Key:x.objectKey}));const data=Buffer.from(await body.Body.transformToByteArray());const t=await p.tenant.findUnique({where:{id:process.env.DEFAULT_TENANT_ID},include:{branding:true}});const staff=await p.staffUser.findMany({select:{id:true,tenantId:true}});console.log(JSON.stringify({bytes:data.toString('base64'),tenantId:t.id,name:t.branding.displayName,staff,databaseSha256:await (${databaseSnapshot.toString()})(p)}));await p.$disconnect()})().catch(()=>process.exit(1))`;
  const probeAt=(project,write=false)=>JSON.parse(run('docker',[...base,'--project-name',project,'exec','-T','api','node','-e',probe],{env,input:JSON.stringify({...payload,write})}));
  const before=probeAt(source,true);
  assert.equal(before.bytes,payload.bytes);assert.equal(before.staff.length,1);
  console.log(cli('backup',source,[archive]));
  pass('quiesced logical PostgreSQL and private MinIO volume snapshot with checksums and restricted secret archive');
  assert.throws(()=>cli('restore',source,[archive]));
  // Stop only the source fixture to release loopback ports. Keep all its volumes.
  compose(source,['stop']);
  console.log(cli('restore',target,[archive]));
  console.log(cli('health',target));
  const after=probeAt(target);
  const restoredAuth=apiFetch(target,{url:'https://auth-gateway/auth/v1/user',headers:{Authorization:`Bearer ${access}`}});
  assert.equal(restoredAuth.status,200);
  const restoredSegment=apiFetch(target,{url:'http://127.0.0.1:3000'+segmentPath,headers:vodHeaders()});
  assert.equal(restoredSegment.status,200);assert.equal(restoredSegment.length,actualSegment.length);assert.equal(restoredSegment.sha256,actualSegment.sha256);
  pass('restored real GoTrue session remains valid; restored private VOD segment accessible with synthetic trusted context');
  assert.deepEqual(after,before);
  assert.throws(()=>cli('restore',target,[archive]));
  pass('actual separate-project database + MinIO restore preserves all public/auth row hashes, RLS/index/grant hashes, tenant/staff/branding and exact object bytes; populated restore denied');
  const manifestPath=path.join(archive,'manifest.json'),manifest=readFileSync(manifestPath,'utf8');
  const bad=JSON.parse(manifest);bad.files['objects.tar']='0'.repeat(64);writeFileSync(manifestPath,JSON.stringify(bad));
  assert.throws(()=>cli('restore','cloudplay-local-corrupt',[archive]));
  assert.equal(compose('cloudplay-local-corrupt',['ps','-a','-q']),'');
  writeFileSync(manifestPath,manifest);
  pass('corrupt archive rejected before restore target resource creation');
  assert.throws(()=>cli('rollback',target,[archive]));
  pass('in-place destructive schema rollback refused; documented rollback is separate-project restore');
  const evidence={head:sha,status:'PASS',checks,scope:'disposable Compose applications + private storage + local GoTrue schema/TLS; not a production or physical-device proof'};
  writeFileSync('selfhost-runtime-evidence.json',JSON.stringify(evidence,null,2));
  console.log('::notice title=Selfhost package verified assertions::'+JSON.stringify(evidence));
} catch(error) {
  const text=String(error.stderr||'')+' '+String(error.stdout||'');
  const known=['Cannot find module','unhealthy','permission denied','unknown flag','service did not complete','port is already allocated','MIGRATIONS_FAILED','BOOTSTRAP_REQUIRES_EMPTY','Build release must equal'];
  console.error('::error title=Selfhost package runtime::'+known.filter(s=>text.toLowerCase().includes(s.toLowerCase())).join(',')+' step failed; no secret values exported');
  throw error;
} finally {
  // Only resources created under these explicit disposable fixture projects.
  for(const project of [source,target,'cloudplay-local-corrupt'])try{compose(project,['down','--volumes','--remove-orphans']);}catch{}
  if(ownedEnv){rmSync('.env');rmSync('.selfhost',{recursive:true,force:true});}rmSync(dir,{recursive:true,force:true});
}
