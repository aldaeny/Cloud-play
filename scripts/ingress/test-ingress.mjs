// Actual TLS/mTLS and proxy sockets. Country/IP are explicit synthetic fixtures,
// not evidence of GeoIP database accuracy or an Internet-facing deployment.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import http from 'node:http';
import {createHmac} from 'node:crypto';
import https from 'node:https';
import {createRequire,Module} from 'node:module';
import {createGateway} from './gateway.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
const file=path.resolve('apps/web/src/server/playback-geo.ts'),mod=new Module(file);mod.filename=file;mod.paths=modulePaths();
function modulePaths(){return [path.resolve('node_modules')];}
mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {verifySelfhostEdge,signHostingGeo}=mod.exports;
const dir=mkdtempSync(path.join(tmpdir(),'cloudplay-ingress-'));
const openssl=args=>execFileSync('openssl',args,{cwd:dir,stdio:'ignore'});
const read=name=>readFileSync(path.join(dir,name));
let backend,gateway,checks=0;
const pass=s=>{checks++;console.log('PASS '+s);};
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));
try{
 openssl(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=isolated-test-CA','-keyout','ca.key','-out','ca.pem']);
 for(const name of ['server','client']){
  openssl(['req','-newkey','rsa:2048','-nodes','-subj',`/CN=${name==='server'?'localhost':'trusted-edge'}`,'-keyout',name+'.key','-out',name+'.csr']);
  openssl(['x509','-req','-in',name+'.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','1','-out',name+'.pem']);
 }
 backend=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({headers:req.headers,url:req.url,method:req.method}));});await listen(backend);
 const secret='isolated-edge-key-not-for-production-32-bytes';
 gateway=createGateway({key:read('server.key'),cert:read('server.pem'),ca:read('ca.pem'),secret,upstream:`http://127.0.0.1:${backend.address().port}`,publicOrigin:'https://viewer.example'});await listen(gateway);
 function request({client=true,headers={},url='/api/vod/catalog'}={}){return new Promise((resolve,reject)=>{const r=https.request({host:'127.0.0.1',port:gateway.address().port,servername:'localhost',path:url,ca:read('ca.pem'),...(client?{key:read('client.key'),cert:read('client.pem')}:{}),headers,timeout:5000},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString()}));});r.on('error',reject);r.on('timeout',()=>r.destroy(new Error('timeout')));r.end();});}
 await assert.rejects(request({client:false}));pass('actual TLS rejects missing client certificate');
 assert.equal((await request()).status,403);pass('authenticated client without country/IP denied');
 for(const country of ['iq','IQ,US','ZZZ'])assert.equal((await request({headers:{'x-cloudplay-country':country,'x-cloudplay-client-ip':'198.51.100.7'}})).status,403);pass('ambiguous country rejected');
 const headers={'x-cloudplay-country':'IQ','x-cloudplay-client-ip':'198.51.100.7',authorization:'Bearer isolated.header.signature',cookie:'__Host-cloudplay-vod=isolated.header.signature','x-forwarded-for':'1.1.1.1','x-vercel-ip-country':'US','x-real-ip':'1.1.1.1','x-cloudplay-edge':'forged','x-external-geo':'forged'};
 const response=await request({headers});assert.equal(response.status,200);const forwarded=JSON.parse(response.text);
 for(const k of ['x-vercel-ip-country','x-forwarded-for','x-real-ip','x-cloudplay-country','x-cloudplay-client-ip','x-external-geo'])assert.equal(forwarded.headers[k],undefined);
 assert.equal(forwarded.headers.host,'viewer.example');pass('actual reverse proxy strips spoofed Geo and forwarding headers and fixes Host');
 process.env.SELFHOST_EDGE_SECRET=secret;process.env.SELFHOST_TRUST_MTLS_EDGE='true';process.env.EXTERNAL_GEO_SIGNING_KEY='separate-isolated-backend-signing-key-32-bytes';
 assert.deepEqual(verifySelfhostEdge(forwarded),{country:'IQ',ip:'198.51.100.7'});
 const signed=signHostingGeo(forwarded,'vod:test','isolated.header.signature',true),payload=JSON.parse(Buffer.from(signed.split('.')[0],'base64url'));assert.equal(payload.country,'IQ');assert.ok(payload.ipHash);pass('real gateway envelope accepted by production web issuer with separate backend scope/key');
 for(const change of [{url:'/other'},{method:'POST'},{headers:{...forwarded.headers,authorization:'Bearer foreign.session.signature'}},{headers:{...forwarded.headers,'x-cloudplay-edge':'forged'}}])assert.throws(()=>verifySelfhostEdge({...forwarded,...change}));pass('method/path/credential substitution and forged envelope denied');
 const expired=JSON.parse(Buffer.from(forwarded.headers['x-cloudplay-edge'].split('.')[0],'base64url'));expired.issuedAt=Date.now()-10000;expired.expiresAt=Date.now()-5000;const encoded=Buffer.from(JSON.stringify(expired)).toString('base64url');assert.throws(()=>verifySelfhostEdge({...forwarded,headers:{...forwarded.headers,'x-cloudplay-edge':encoded+'.'+createHmac('sha256',secret).update(encoded).digest('base64url')}}));pass('expired authentic edge envelope denied');
 process.env.SELFHOST_EDGE_SECRET='wrong-key-at-least-thirty-two-bytes';assert.throws(()=>verifySelfhostEdge(forwarded));pass('wrong edge signing key denied');
 console.log(`INGRESS TLS: ${checks} checks PASS; synthetic country/IP only, no real public ingress proof.`);
}finally{await Promise.all([gateway,backend].filter(Boolean).map(s=>new Promise(r=>s.close(r))));rmSync(dir,{recursive:true,force:true});}
