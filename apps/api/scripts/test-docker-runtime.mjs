// Real Docker image/native Prisma/isolated PostgreSQL. No production URL read.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
const image='cloudplay-api:isolated-verification',network='cloudplay-runtime-fixture',db='cloudplay-runtime-db',api='cloudplay-runtime-api';
const run=(args,opts={})=>execFileSync('docker',args,{timeout:180000,stdio:['pipe','pipe','pipe'],...opts}).toString().trim();
const checks=[];
const passed=label=>{checks.push(label);console.log('PASS '+label);};
const password=randomBytes(24).toString('hex');
const config={NODE_ENV:'production',API_END_USER_AUTHORITY:'supabase',DATABASE_URL:`postgresql://postgres:${password}@${db}:5432/postgres?connection_limit=3&pool_timeout=5&connect_timeout=1`,JWT_ACCESS_SECRET:randomBytes(32).toString('hex'),JWT_REFRESH_SECRET:randomBytes(32).toString('hex'),ADMIN_JWT_SECRET:randomBytes(32).toString('hex'),XTREAM_ENCRYPTION_KEY:randomBytes(32).toString('hex'),DEFAULT_TENANT_ID:randomUUID()};
const envArgs=Object.entries(config).flatMap(([k,v])=>['-e',k+'='+v]);
let ownedNetwork=false,ownedDb=false,ownedApi=false;
const waitHealth=async(expected,limit=40)=>{for(let i=0;i<limit;i++){try{const code=run(['exec',api,'node','-e',"fetch('http://127.0.0.1:3000/health',{signal:AbortSignal.timeout(6000)}).then(r=>console.log(r.status)).catch(()=>process.exit(1))"]);if(code===String(expected))return;}catch{}await wait(500);}throw new Error('HEALTH_CHECK_FAILED');};
try{
 run(['version']);
 assert.equal(run(['image','inspect','--format','{{.Config.User}}',image]),'node');
 const baked=JSON.parse(run(['image','inspect','--format','{{json .Config.Env}}',image]));
 assert.ok(!baked.some(s=>/^(?:DATABASE_URL|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|ADMIN_JWT_SECRET|XTREAM_ENCRYPTION_KEY|SUPABASE.*)=/.test(s)));
 assert.equal(run(['run','--rm',image,'node','-e',"const fs=require('fs');for(const p of ['/app/.env','/app/.env.docker-canary','/app/.git','/app/docs'])if(fs.existsSync(p))process.exit(1);console.log('clean')"]),'clean');
 passed('runtime image is non-root; no baked credential env, root env/canary/git/docs files');
 const engines=run(['run','--rm',image,'node','-e',"const fs=require('fs');const p='/app/node_modules/.prisma/client';const e=fs.readdirSync(p).filter(n=>/^libquery_engine-.*\\.so\\.node$/.test(n));if(!e.length)process.exit(1);for(const n of e)require(p+'/'+n);console.log(e.join(','))"]);
 assert.match(engines,/debian-openssl-3\.0/);passed('actual native Prisma engine loads in Debian/OpenSSL3 Node22 runtime image');
 assert.throws(()=>run(['run','--rm',image]));passed('production startup fails closed without mandatory configuration');
 run(['network','create',network]);ownedNetwork=true;
 run(['run','-d','--name',db,'--label','cloudplay.fixture=docker-native','--network',network,'-e','POSTGRES_PASSWORD='+password,'postgres:17']);ownedDb=true;
 let ready=false;for(let i=0;i<40;i++){try{run(['exec',db,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{}await wait(500);}assert.ok(ready);
 for(const dir of (await readdir('apps/api/prisma/migrations')).sort()){
  if(dir==='migration_lock.toml')continue;
  run(['exec','-i',db,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:await readFile('apps/api/prisma/migrations/'+dir+'/migration.sql')});
 }
 passed('all current migrations applied to disposable PostgreSQL17 with ON_ERROR_STOP');
 run(['run','-d','--init','--name',api,'--label','cloudplay.fixture=docker-native','--network',network,...envArgs,image]);ownedApi=true;await waitHealth(200);
 const probe=JSON.parse(run(['exec',api,'node','-e',"const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const n=await p.tenant.count();const rows=await p.$queryRaw`SELECT count(*)::int AS connections FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend'`;console.log(JSON.stringify({tenants:n,connections:rows[0].connections}));await p.$disconnect()})().catch(()=>process.exit(1))"]));
 assert.equal(probe.tenants,0);assert.ok(probe.connections<=6);passed('running production image executes actual native Prisma model query; explicit per-process pool3 budget');
 run(['stop','-t','5',db]);await waitHealth(503,10);passed('health/readiness returns503 during actual DB outage');
 run(['start',db]);await waitHealth(200,40);passed('same running application reconnects after isolated DB restart');
 // /health is the existing database-aware readiness contract. Do not invent a
 // second endpoint or claim liveness is independent of database availability.
 const start=performance.now();run(['stop','-t','10',api]);
 const exit=JSON.parse(run(['inspect','--format','{{json .State}}',api]));assert.equal(exit.ExitCode,0);assert.equal(exit.OOMKilled,false);assert.ok(performance.now()-start<11000);passed('SIGTERM executes graceful app.close/disconnect and exits0 without forced kill');
 run(['start',api]);await waitHealth(200);passed('production image restarts; native DB/health remains intact');
 const result={status:'PASS',scope:'real Docker production image; isolated PostgreSQL17 only',checks,engine:engines,node:run(['exec',api,'node','--version']),production_accessed:false,secret_values_exported:false};
 await writeFile('docker-runtime-evidence.json',JSON.stringify(result,null,2)+'\n');console.log('::notice title=Docker native runtime assertions::'+JSON.stringify(result));
}catch(error){
 let diagnostic={};
 if(ownedApi){
  const output=spawnSync('docker',['logs',api],{encoding:'utf8',timeout:10000});const logs=String(output.stdout||'')+String(output.stderr||'');
  const state=JSON.parse(run(['inspect','--format','{{json .State}}',api]));
  diagnostic={container_exit:state.ExitCode,oom_killed:state.OOMKilled,missing_modules:[...logs.matchAll(/Cannot find module '([a-zA-Z0-9_@./-]+)'/g)].map(m=>m[1]),prisma_codes:[...new Set(logs.match(/P10[0-9]{2}/g)||[])],missing_packages:[...logs.matchAll(/The "([a-zA-Z0-9_@./-]+)" package is missing/g)].map(m=>m[1]),config_errors:['Production JWT secrets','Production DATABASE_URL','Production end-user authority','Production database requires','Production XTREAM_ENCRYPTION_KEY','Production DEFAULT_TENANT_ID'].filter(s=>logs.includes(s))};
 }
 const result={status:'FAIL',diagnostic,completed_checks:checks,checkpoint:'after_check_'+checks.length,error_type:['AssertionError','Error','TypeError'].includes(error?.name)?error.name:'Error',exit_status:typeof error?.status==='number'?error.status:null,actual:typeof error?.actual==='number'?error.actual:null,expected:typeof error?.expected==='number'?error.expected:null,production_accessed:false};
 await writeFile('docker-runtime-evidence.json',JSON.stringify(result,null,2)+'\n');console.log('::error title=Docker native runtime failure::'+JSON.stringify(result));process.exitCode=1;

}finally{
 if(ownedApi)run(['rm','-f',api]);if(ownedDb)run(['rm','-f',db]);if(ownedNetwork)run(['network','rm',network]);
}
