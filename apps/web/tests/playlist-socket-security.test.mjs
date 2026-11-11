// Actual HTTP request -> compiled playlist route -> guarded DNS -> real socket.
// Only DNS answers and final public-IP routing are fixture seams; no provider contact.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../../',import.meta.url)));
const out=mkdtempSync(path.join(tmpdir(),'playlist-route-socket-'));
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','apps/web/pages/api/playlist/stream.ts','--outDir',out,'--module','commonjs','--target','es2022','--esModuleInterop','--skipLibCheck','--strict']);
const require=createRequire(path.join(out,'test.cjs')),http=require('node:http'),dns=require('node:dns/promises');
const https=require('node:https');
const originalRequest=http.request,originalSecureRequest=https.request,originalLookup=dns.lookup;
let secureOrigin,badOrigin;let tlsPort=0,badPort=0,sni='';
const {sealStream,openStream}=require('./src/server/playlist-token.js');
const {resetHostVerdicts}=require('./src/server/safe-fetch.js');
const handler=require('./pages/api/playlist/stream.js').default;
const secret='isolated-playlist-route-socket-secret';process.env.PLAYLIST_PROXY_SECRET=secret;
let answers=[],sockets=0,upstreamRequests=0,pinned=[];
const origin=http.createServer((req,res)=>{
 upstreamRequests++;
 if(req.url==='/internal'){res.writeHead(302,{location:'http://169.254.169.254/latest/meta-data'});res.end();}
 else if(req.url.startsWith('/chain/')){const n=Number(req.url.split('/').at(-1));res.writeHead(302,{location:'/chain/'+(n+1)});res.end();}
 else if(req.url==='/hop'){res.writeHead(302,{location:'/good.m3u8'});res.end();}
 else if(req.url==='/good.m3u8'){res.setHeader('content-type','application/vnd.apple.mpegurl');res.end('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:2,\nseg.ts\n#EXT-X-ENDLIST');}
 else {res.setHeader('content-type','video/mp2t');res.end(Buffer.alloc(188,71));}
});
await new Promise(resolve=>origin.listen(0,'127.0.0.1',resolve));const port=origin.address().port;
const edge=http.createServer((req,res)=>{
 req.query=Object.fromEntries(new URL(req.url,'http://fixture').searchParams);req.cookies={};
 res.status=code=>{res.statusCode=code;return res;};res.json=value=>res.end(JSON.stringify(value));res.send=value=>res.end(value);
 void handler(req,res).catch(()=>{if(!res.headersSent)res.statusCode=500;res.end();});
});await new Promise(resolve=>edge.listen(0,'127.0.0.1',resolve));
dns.lookup=async()=>answers.shift()||[{address:'8.8.8.8',family:4}];
http.request=(url,options,cb)=>{
 assert.equal(url.hostname,'fixture.example','fixture forbids any real outbound origin');assert.equal(options.agent,false);
 return originalRequest(url,{...options,lookup:(host,opts,done)=>options.lookup(host,opts,(error,address,family)=>{
  if(error)return done(error);
  const values=Array.isArray(address)?address:[{address,family}];pinned.push(...values.map(v=>v.address));sockets++;
  // Only previously validated public destinations are mapped to the local fixture.
  if(opts.all)done(null,[{address:'127.0.0.1',family:4}]);else done(null,'127.0.0.1',4);
 })},cb);
};
const grant=(target,ttl=30000)=>{const u=new URL(target);return sealStream({origin:u.origin,path:u.pathname+u.search},secret,ttl);};
const hit=token=>fetch(`http://127.0.0.1:${edge.address().port}/api/playlist/stream?t=${encodeURIComponent(token)}`,{signal:AbortSignal.timeout(5000)});
let passed=0;
const check=async(name,fn)=>{answers=[];pinned=[];resetHostVerdicts();await fn();passed++;console.log('PASS '+name);};
try{
 for(const name of ['fixture.example','mismatch.example'])execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN='+name,'-addext','subjectAltName=DNS:'+name,'-keyout',path.join(out,name+'.key'),'-out',path.join(out,name+'.pem')],{stdio:'ignore'});
 const cert=readFileSync(path.join(out,'fixture.example.pem')),badCert=readFileSync(path.join(out,'mismatch.example.pem'));
 secureOrigin=https.createServer({key:readFileSync(path.join(out,'fixture.example.key')),cert},(req,res)=>{sni=req.socket.servername;res.setHeader('content-type','video/mp2t');res.end(Buffer.alloc(188,71));});
 badOrigin=https.createServer({key:readFileSync(path.join(out,'mismatch.example.key')),cert:badCert},(_req,res)=>res.end('must not read'));
 for(const srv of [secureOrigin,badOrigin])await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));tlsPort=secureOrigin.address().port;badPort=badOrigin.address().port;
 https.request=(url,options,cb)=>{assert.equal(url.hostname,'fixture.example');assert.equal(options.rejectUnauthorized,true);assert.equal(options.agent,false);return originalSecureRequest(url,{...options,ca:url.port===String(badPort)?badCert:cert,lookup:(host,opts,done)=>options.lookup(host,opts,(error,address,family)=>{if(error)return done(error);pinned.push(...(Array.isArray(address)?address.map(v=>v.address):[address]));sockets++;if(opts.all)done(null,[{address:'127.0.0.1',family:4}]);else done(null,'127.0.0.1',4);})},cb);};
 await check('actual TLS keeps original hostname verification and SNI while pinning IP',async()=>{const r=await hit(grant(`https://fixture.example:${tlsPort}/seg.ts`));assert.equal(r.status,200);await r.arrayBuffer();assert.equal(sni,'fixture.example');assert.deepEqual(pinned,['8.8.8.8']);});
 await check('actual TLS rejects a trusted certificate for the wrong hostname',async()=>{assert.equal((await hit(grant(`https://fixture.example:${badPort}/seg.ts`))).status,502);});
 await check('legacy unbound capability without live Auth fails closed in production before any socket',async()=>{const old=process.env.NODE_ENV,origin=process.env.PRIVATE_MEDIA_PUBLIC_ORIGIN;process.env.NODE_ENV='production';process.env.PRIVATE_MEDIA_PUBLIC_ORIGIN='https://private.example';try{const before=sockets;const r=await hit(grant(`http://fixture.example:${port}/seg.ts`));assert.equal(r.status,401);assert.deepEqual(await r.json(),{error:'SIGN_IN_REQUIRED'});assert.equal(sockets,before);}finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;if(origin===undefined)delete process.env.PRIVATE_MEDIA_PUBLIC_ORIGIN;else process.env.PRIVATE_MEDIA_PUBLIC_ORIGIN=origin;}});
 for(const target of ['http://127.0.0.1/','http://[::1]/','http://10.0.0.1/','http://172.16.0.1/','http://192.168.0.1/','http://[fc00::1]/','http://169.254.169.254/','http://[fe80::1]/','http://[ff02::1]/','http://0.0.0.0/','http://224.0.0.1/','http://198.18.0.1/','http://100.64.0.1/','http://[::ffff:127.0.0.1]/','http://2130706433/','http://0x7f000001/','http://0177.0.0.1/','http://metadata.google.internal/','http://fixture.example:5432/','http://fixture.example:22/']){
  await check('HTTP route denies forbidden target '+new URL(target).hostname,async()=>{const before=sockets;assert.equal((await hit(grant(target))).status,403);assert.equal(sockets,before);});
 }
 for(const address of ['127.0.0.1','10.1.2.3','::1','fc00::1','fe80::1','169.254.169.254','::ffff:7f00:1']){
  await check('HTTP route denies DNS rebinding to '+address,async()=>{answers=[[{address:'8.8.8.8',family:4}],[{address,family:address.includes(':')?6:4}]];const before=sockets;const r=await hit(grant(`http://fixture.example:${port}/seg.ts`));assert.ok(r.status>=400);assert.equal(sockets,before);});
 }
 await check('mixed public/private A+AAAA answers denied on socket lookup',async()=>{answers=[[{address:'8.8.8.8',family:4}],[{address:'8.8.8.8',family:4},{address:'fc00::1',family:6}]];const before=sockets;assert.ok((await hit(grant(`http://fixture.example:${port}/seg.ts`))).status>=400);assert.equal(sockets,before);});
 await check('all-public multiaddress connection pins exactly one validated IP',async()=>{answers=[[{address:'8.8.8.8',family:4}],[{address:'1.1.1.1',family:4},{address:'2606:4700:4700::1111',family:6}]];const r=await hit(grant(`http://fixture.example:${port}/seg.ts`));assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,188);assert.deepEqual(pinned,['1.1.1.1']);});
 await check('public redirect to metadata denied without internal socket',async()=>{const before=upstreamRequests;assert.equal((await hit(grant(`http://fixture.example:${port}/internal`))).status,403);assert.equal(upstreamRequests,before+1);});
 await check('redirect chain bounded at four socket requests',async()=>{const before=upstreamRequests;assert.ok((await hit(grant(`http://fixture.example:${port}/chain/0`))).status>=400);assert.equal(upstreamRequests,before+4);});
 await check('safe same-origin redirect preserves HLS and rewrites key/segment without extending expiry',async()=>{const token=grant(`http://fixture.example:${port}/hop`,5000),parent=openStream(token,secret);const r=await hit(token);assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('fixture.example'));const tokens=[...text.matchAll(/\/api\/playlist\/stream\?t=([^"\s]+)/g)].map(m=>decodeURIComponent(m[1]));assert.equal(tokens.length,2);for(const t of tokens){assert.ok(openStream(t,secret).expiresAt<=parent.expiresAt);assert.equal((await hit(t)).status,200);}});
 console.log(`PLAYLIST SOCKET SECURITY: ${passed} checks PASS; real HTTP boundary/sockets, synthetic DNS, no provider contact.`);console.log(`::notice title=Playlist socket security::${passed} PASS; actual HTTP route and sockets; TLS hostname/SNI, all-answer DNS validation, rebinding, mixed A/AAAA, unsafe redirects, port/IP denial, nested TTL cap, production legacy gate.`);
}finally{dns.lookup=originalLookup;http.request=originalRequest;https.request=originalSecureRequest;for(const s of [edge,origin,secureOrigin,badOrigin].filter(Boolean)){s.closeAllConnections();await new Promise(resolve=>s.close(resolve));}rmSync(out,{recursive:true,force:true});}
