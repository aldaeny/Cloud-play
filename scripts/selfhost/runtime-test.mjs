// Executes the shipped lifecycle CLI against disposable real Compose services.
// Never accepts a production URL. Does not stand in for a hosted Auth/device test.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
  // Avoid collisions with the other isolated runtime job. No host-service ports needed.
  console.log(cli('install',source));
  console.log(cli('health',source));
  pass('actual package builds and installs API/worker/web/admin/storage/database; native migrations and unique first-admin bootstrap');
  assert.throws(()=>cli('install',source));
  assert.throws(()=>compose(source,['run','--rm','--no-deps','-e','BOOTSTRAP_ADMIN_EMAIL','-e','BOOTSTRAP_ADMIN_PASSWORD','tools','bootstrap']));
  pass('repeat install/bootstrap refuse existing data and never reset admin credentials');
  const payload={objectKey:`synthetic/${randomUUID()}.txt`,bytes:randomBytes(1024).toString('base64')};
  const probe=`const {PrismaClient}=require('@prisma/client');const {S3Client,PutObjectCommand,GetObjectCommand}=require('@aws-sdk/client-s3');const fs=require('fs');const p=new PrismaClient();const s=new S3Client({endpoint:process.env.STORAGE_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.STORAGE_ACCESS_KEY,secretAccessKey:process.env.STORAGE_SECRET_KEY}});(async()=>{const x=JSON.parse(fs.readFileSync(0,'utf8'));if(x.write)await s.send(new PutObjectCommand({Bucket:process.env.STORAGE_BUCKET,Key:x.objectKey,Body:Buffer.from(x.bytes,'base64'),ContentType:'text/plain'}));const body=await s.send(new GetObjectCommand({Bucket:process.env.STORAGE_BUCKET,Key:x.objectKey}));const data=Buffer.from(await body.Body.transformToByteArray());const t=await p.tenant.findUnique({where:{id:process.env.DEFAULT_TENANT_ID},include:{branding:true}});const staff=await p.staffUser.findMany({select:{id:true,tenantId:true}});console.log(JSON.stringify({bytes:data.toString('base64'),tenantId:t.id,name:t.branding.displayName,staff}));await p.$disconnect()})().catch(()=>process.exit(1))`;
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
  assert.deepEqual(after,before);
  assert.throws(()=>cli('restore',target,[archive]));
  pass('actual separate-project database + MinIO restore preserves tenant, branding, staff and exact object bytes; populated restore denied');
  const manifestPath=path.join(archive,'manifest.json'),manifest=readFileSync(manifestPath,'utf8');
  const bad=JSON.parse(manifest);bad.files['objects.tar']='0'.repeat(64);writeFileSync(manifestPath,JSON.stringify(bad));
  assert.throws(()=>cli('restore','cloudplay-local-corrupt',[archive]));
  assert.equal(compose('cloudplay-local-corrupt',['ps','-a','-q']),'');
  writeFileSync(manifestPath,manifest);
  pass('corrupt archive rejected before restore target resource creation');
  assert.throws(()=>cli('rollback',target,[archive]));
  pass('in-place destructive schema rollback refused; documented rollback is separate-project restore');
  writeFileSync('selfhost-runtime-evidence.json',JSON.stringify({head:sha,status:'PASS',checks,scope:'disposable Compose applications + private storage + local GoTrue schema/TLS; not a production or physical-device proof'},null,2));
} finally {
  // Only resources created under these explicit disposable fixture projects.
  for(const project of [source,target,'cloudplay-local-corrupt'])try{compose(project,['down','--volumes','--remove-orphans']);}catch{}
  if(ownedEnv){rmSync('.env');rmSync('.selfhost',{recursive:true,force:true});}rmSync(dir,{recursive:true,force:true});
}
