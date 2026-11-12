// Disposable Docker configuration validation; never accepts an existing .env.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,rmSync} from 'node:fs';
import {parseEnvironment} from '../selfhost/policy.mjs';
import path from 'node:path';
const run=(cmd,args,options={})=>execFileSync(cmd,args,{maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe'],...options}).toString();
if(existsSync('.env')||existsSync('.selfhost'))throw new Error('Existing operator config left untouched');
let owned=false;
try{
 run(process.execPath,['scripts/selfhost/init.mjs']);owned=true;
 const local=parseEnvironment(readFileSync('.env','utf8'));
 const env={...process.env,...local,SELFHOST_RELEASE:run('git',['rev-parse','HEAD']).trim(),VOD_PUBLIC_ORIGIN:'https://synthetic.example',SELFHOST_EDGE_SECRET:'isolated-compose-edge-key-at-least-32-bytes',SELFHOST_INGRESS_ROOT:path.resolve('.selfhost/tls')};
 const files=['compose.yml','compose.local.yml','compose.selfhost.yml','compose.ingress.yml'].flatMap(f=>['-f','infra/docker/'+f]);
 const config=JSON.parse(run('docker',['compose','--env-file','.env',...files,'config','--format','json'],{env}));
 assert.equal(config.services.web.environment.API_INTERNAL_URL,'https://api-gateway');
 assert.equal(config.services.web.environment.SELFHOST_TRUST_MTLS_EDGE,'true');
 assert.equal(config.services.auth.environment.API_EXTERNAL_URL,'https://synthetic.example/auth/v1');
 assert.equal(config.services.web.build.args.NEXT_PUBLIC_SUPABASE_URL,'https://synthetic.example');
 assert.equal(config.services.ingress.ports[0].host_ip,'127.0.0.1');
 assert.equal(config.services['api-gateway'].ports,undefined);
 run('docker',['run','--rm','--add-host','api:127.0.0.1','-v',path.resolve('infra/docker/selfhost-api-tls.conf')+':/etc/nginx/conf.d/default.conf:ro','-v',path.resolve('.selfhost/tls')+':/tls:ro','cloudplay-gateway:verification','nginx','-t']);
 console.log('PASS actual Compose ingress overlay expansion, private bindings, public Auth build origin and actual nginx private API TLS config validation; synthetic config only');
}finally{if(owned){rmSync('.env');rmSync('.selfhost',{recursive:true,force:true});}}
