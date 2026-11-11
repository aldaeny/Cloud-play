// Production route -> modeled trusted edge -> live-authorization contract ->
// actual pinned outbound sockets. Auth response is a fixture here; separate CI
// GoTrue/native PostgreSQL test proves the real authorization endpoint.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../../',import.meta.url));process.chdir(root);
const out=mkdtempSync(path.join(root,'apps/web/.private-bound-test-'));
const routes=['playlist/import','playlist/stream','xtream/play','xtream/stream','private-media/renew'];
execFileSync(process.execPath,['node_modules/typescript/bin/tsc',...routes.map(r=>'apps/web/pages/api/'+r+'.ts'),'--outDir',out,'--module','commonjs','--target','es2022','--esModuleInterop','--skipLibCheck','--strict']);
const require=createRequire(path.join(out,'test.cjs')),http=require('node:http'),dns=require('node:dns/promises');
const handlers=Object.fromEntries(routes.map(r=>['/api/'+r,require('./pages/api/'+r+'.js').default]));
const pt=require('./src/server/playlist-token.js'),xt=require('./src/server/xtream-token.js');
const {signHostingGeo}=require('./src/server/playback-geo.js');
const {resetHostVerdicts}=require('./src/server/safe-fetch.js');
const {PRIVATE_COOKIE}=require('./src/server/private-media-session.js');
const secret='isolated-bound-media-proxy-secret-32',geoKey='isolated-bound-media-request-geo-key';
Object.assign(process.env,{NODE_ENV:'production',PRIVATE_MEDIA_PUBLIC_ORIGIN:'https://private.example',API_INTERNAL_URL:'https://backend.invalid',VERCEL:'1',EXTERNAL_TRUST_VERCEL_GEO:'true',EXTERNAL_GEO_SIGNING_KEY:geoKey,PLAYLIST_PROXY_SECRET:secret,XTREAM_PROXY_SECRET:secret,XTREAM_CATALOG_ENABLED:'true',XTREAM_BASE_URL:'http://fixture.example',XTREAM_ALLOW_HTTP:'true',XTREAM_USERNAME:'synthetic-user',XTREAM_PASSWORD:'synthetic-password'});
const originalRequest=http.request,originalLookup=dns.lookup,realFetch=global.fetch;
let country='IQ',ip='8.8.8.8',authStatus=201,answers=[],sockets=0,authCalls=0,upstreamCalls=0,checks=0,manifest;
const userId='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222';
let currentUser=userId,currentSession=sessionId;
const bearer='header.isolated-payload.signature';
const binding=()=>({userId:currentUser,sessionId:currentSession,country,ipHash:JSON.parse(Buffer.from(signHostingGeo({headers:{'x-vercel-ip-country':country,'x-vercel-forwarded-for':ip}},'private-media',bearer,true).split('.')[0],'base64url')).ipHash,expiresAt:Date.now()+3600000});
global.fetch=async(input,init)=>{
 assert.equal(String(input),'https://backend.invalid/private-media/authorize','no other Auth/provider contact');authCalls++;
 assert.equal(init.redirect,'error');assert.equal(init.method,'POST');assert.equal(init.headers.Authorization,`Bearer ${bearer}`);assert.ok(init.headers['x-external-geo']);
 return Response.json(authStatus===201?binding():{error:'denied'},{status:authStatus});
};
const upstream=http.createServer((req,res)=>{
 upstreamCalls++;if(req.url==='/list.m3u'){res.setHeader('content-type','audio/x-mpegurl');return res.end(`#EXTM3U\n#EXTINF:-1 group-title="Synthetic",Keep name\nhttp://fixture.example:${upstream.address().port}/master.m3u8`);}
 if(req.url==='/redirect'){res.writeHead(302,{location:'http://169.254.169.254/latest/meta-data/'});return res.end();}
 if(req.url==='/fail'){res.writeHead(503);return res.end();}
 if(/m3u8/.test(req.url)){res.setHeader('content-type','application/vnd.apple.mpegurl');return res.end(manifest||'#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:2,\nseg.ts\n#EXT-X-ENDLIST');}
 if(req.url.endsWith('/key.bin'))return res.end(Buffer.alloc(16,4));
 res.setHeader('content-type','video/mp2t');res.end(Buffer.alloc(188,71));
});await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const port=upstream.address().port;process.env.XTREAM_BASE_URL=`http://fixture.example:${port}`;
const edge=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://edge');req.query=Object.fromEntries(url.searchParams);req.cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
 // Isolated edge always overwrites modeled hosting metadata. These variables
 // are test controls, not headers/backdoors in application code.
 req.headers['x-vercel-ip-country']=country;req.headers['x-vercel-forwarded-for']=ip;
 const chunks=[];for await(const b of req)chunks.push(b);try{req.body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};}catch{res.statusCode=400;return res.end();}
 res.status=n=>{res.statusCode=n;return res;};res.json=v=>res.end(JSON.stringify(v));res.send=v=>res.end(v);
 try{await handlers[url.pathname](req,res);}catch{if(!res.headersSent)res.statusCode=500;res.end();}
});await new Promise(r=>edge.listen(0,'127.0.0.1',r));
dns.lookup=async()=>answers.shift()||[{address:'8.8.8.8',family:4}];
http.request=(url,options,cb)=>{assert.equal(url.hostname,'fixture.example');assert.equal(options.agent,false);return originalRequest(url,{...options,lookup:(h,o,done)=>options.lookup(h,o,(error,address,family)=>{if(error)return done(error);const values=Array.isArray(address)?address:[{address,family}];assert.ok(values.every(v=>v.address==='8.8.8.8'));sockets++;if(o.all)done(null,[{address:'127.0.0.1',family:4}]);else done(null,'127.0.0.1',4);})},cb);};
const hit=(url,options={})=>realFetch(`http://127.0.0.1:${edge.address().port}`+url,{signal:AbortSignal.timeout(10000),headers:{cookie:`${PRIVATE_COOKIE}=${bearer}`,...options.headers},...options});
const mint=(url,patch={})=>{const u=new URL(url);return '/api/playlist/stream?t='+pt.sealStream({origin:u.origin,path:u.pathname+u.search,binding:binding(),...patch},secret,120000);};
const renew=async url=>hit('/api/private-media/renew',{method:'POST',headers:{origin:'https://private.example',authorization:`Bearer ${bearer}`,'content-type':'application/json'},body:JSON.stringify({url})});
const check=async(name,fn)=>{resetHostVerdicts();answers=[];authStatus=201;currentUser=userId;currentSession=sessionId;country='IQ';ip='8.8.8.8';manifest=undefined;await fn();checks++;console.log('PASS '+name);};
try{
 await check('import works in production with a live owner context and hides origin credentials',async()=>{
  const r=await hit('/api/playlist/import',{method:'POST',headers:{origin:'https://private.example',authorization:`Bearer ${bearer}`,'content-type':'application/json'},body:JSON.stringify({url:`http://fixture.example:${port}/list.m3u`})});assert.equal(r.status,200);const body=await r.json();assert.equal(body.data.channels[0].name,'Keep name');assert.match(body.data.channels[0].url,/&session=1$/);assert.ok(!JSON.stringify(body).includes('synthetic-password'));assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 });
 for(const kind of ['playlist','xtream']){
  let selection,url;
  await check(`${kind} selection is non-playable, live exchange mints a short bound media grant`,async()=>{
   if(kind==='playlist'){selection=mint(`http://fixture.example:${port}/master.m3u8`,{purpose:'selection',expiresAt:Date.now()+3600000})+'&session=1';}
   else{const r=await hit('/api/xtream/play?kind=live&id=1',{headers:{authorization:`Bearer ${bearer}`}});assert.equal(r.status,200);selection=(await r.json()).url;}
   assert.equal((await hit(selection)).status,403);const r=await renew(selection);assert.equal(r.status,200);const body=await r.json();assert.ok(body.expiresAt<=Date.now()+120000);url=body.url;assert.equal((await hit(url)).status,200);
  });
  await check(`${kind} complete manifest -> init -> AES128 identity key -> last segment uses Auth every time`,async()=>{
   const r=await hit(url);assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('fixture.example'));assert.ok(!text.includes('synthetic-user'));const refs=[...text.matchAll(/URI="([^"]+)"/g)].map(x=>x[1]);refs.push(...text.split('\n').filter(x=>x.startsWith('/api/')));assert.equal(refs.length,3);for(const ref of refs){const before=authCalls;const r=await hit(ref);assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>=16);assert.ok(authCalls>=before+2);}
  });
  for(const [name,change] of [['other user',()=>currentUser='33333333-3333-4333-8333-333333333333'],['other session',()=>currentSession='44444444-4444-4444-8444-444444444444'],['IP change',()=>ip='1.1.1.1'],['country change',()=>country='US'],['revoked session',()=>authStatus=403],['expired Auth',()=>authStatus=401],['Auth outage',()=>authStatus=503]])await check(`${kind} denies ${name} before any provider socket`,async()=>{const before=sockets;change();assert.ok((await hit(url)).status>=400);assert.equal(sockets,before);assert.ok((await renew(selection)).status>=400);});
  await check(`${kind} capability alone and cross-site requests cannot read media`,async()=>{const before=sockets;assert.equal((await hit(url,{headers:{}})).status,401);assert.equal((await hit(url,{headers:{cookie:`${PRIVATE_COOKIE}=${bearer}`,'sec-fetch-site':'cross-site'}})).status,403);assert.equal(sockets,before);});
  await check(`${kind} children and explicit renewal never extend original absolute cap`,async()=>{const t=new URL(selection,'https://fixture').searchParams.get('t');const g=kind==='playlist'?pt.openStream(t,secret):xt.openToken(t,secret);const cap=Date.now()+1000;g.expiresAt=cap;g.binding.expiresAt=cap;const selected=kind==='playlist'?pt.sealStream(g,secret,60000):xt.sealPath(g.path,secret,60000,cap,g.binding,g.origin,undefined,'selection',g.source);const r=await renew(`/api/${kind}/stream?t=${selected}&session=1`);assert.equal(r.status,200);const b=await r.json();assert.ok(b.expiresAt<=cap);const text=await(await hit(b.url)).text();for(const ref of [...text.matchAll(/(?:t=)([A-Za-z0-9_-]+)/g)]){const child=kind==='playlist'?pt.openStream(ref[1],secret):xt.openToken(ref[1],secret);assert.ok(child.expiresAt<=cap);}});
 }
 await check('old standalone tokens remain denied after successful live authorization',async()=>{const before=sockets;for(const url of ['/api/playlist/stream?t='+pt.sealStream({origin:`http://fixture.example:${port}`,path:'/seg.ts'},secret),'/api/xtream/stream?t='+xt.sealPath('/seg.ts',secret)])assert.equal((await hit(url)).status,403);assert.equal(sockets,before);});
 await check('expired resource and expired selection cannot be revived',async()=>{assert.equal((await hit(mint(`http://fixture.example:${port}/seg.ts`,{expiresAt:Date.now()-1}))).status,403);const selection=mint(`http://fixture.example:${port}/master.m3u8`,{purpose:'selection',expiresAt:Date.now()-1})+'&session=1';assert.equal((await renew(selection)).status,403);});
 await check('source switching revokes old Xtream selection and media',async()=>{const r=await hit('/api/xtream/play?kind=live&id=1',{headers:{authorization:`Bearer ${bearer}`}});const selection=(await r.json()).url;const media=(await(await renew(selection)).json()).url;process.env.XTREAM_PASSWORD='changed-synthetic-password';try{assert.equal((await renew(selection)).status,403);assert.equal((await hit(media)).status,403);}finally{process.env.XTREAM_PASSWORD='synthetic-password';}});
 await check('fresh production route DNS rebinding/mixed answers rejected at socket, not just helper',async()=>{for(const list of [[{address:'127.0.0.1',family:4}],[{address:'8.8.8.8',family:4},{address:'::1',family:6}]]){resetHostVerdicts();answers=[[{address:'8.8.8.8',family:4}],list];const before=sockets;assert.ok((await hit(mint(`http://fixture.example:${port}/seg.ts`))).status>=400);assert.equal(sockets,before);}});
 await check('off-origin redirect never opens metadata socket',async()=>{const before=upstreamCalls;assert.equal((await hit(mint(`http://fixture.example:${port}/redirect`))).status,502);assert.equal(upstreamCalls,before+1);});
 await check('upstream failure is sanitized and original URL never returned',async()=>{const r=await hit(mint(`http://fixture.example:${port}/fail`));assert.equal(r.status,502);assert.deepEqual(await r.json(),{error:'UPSTREAM_ERROR'});});
 for(const bad of ['#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key.bin"\nseg.ts','#EXTM3U\n#EXT-X-CONTENT-STEERING:SERVER-URI="https://evil.example"\nseg.ts','#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=key.bin\nseg.ts','#EXTM3U\nhttp://169.254.169.254/meta','#EXTM3U\n#EXT-X-DEFINE:NAME="x",VALUE="bad"\n{$x}'])await check('unsafe or unsupported HLS URI/key grammar fails closed '+checks,async()=>{manifest=bad;assert.equal((await hit(mint(`http://fixture.example:${port}/master.m3u8`))).status,502);});
 await check('concurrent authorized segments preserve per-request authorization',async()=>{const url=mint(`http://fixture.example:${port}/seg.ts`);const before=authCalls;await Promise.all(Array.from({length:5},async()=>{const r=await hit(url);assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,188);}));assert.ok(authCalls>=before+10);});
 await check('spoofed generic forwarding/country headers never replace dedicated ingress metadata',async()=>{const r=await hit(mint(`http://fixture.example:${port}/seg.ts`),{headers:{cookie:`${PRIVATE_COOKIE}=${bearer}`,'x-forwarded-for':'127.0.0.1','x-real-ip':'1.1.1.1','x-country':'US','x-external-geo':'forged'}});assert.equal(r.status,200);});
 await check('missing/duplicate/noncanonical trusted IP cannot be signed from generic XFF',async()=>{for(const ip of [undefined,'8.8.8.8,1.1.1.1','127.1','fe80::1%eth0'])assert.throws(()=>signHostingGeo({headers:{'x-vercel-ip-country':'IQ','x-vercel-forwarded-for':ip,'x-forwarded-for':'8.8.8.8'}},'private-media',bearer,true));});
 console.log(`PRIVATE MEDIA PRODUCTION ROUTES: ${checks} PASS; modeled ingress/Auth response, actual guarded sockets; not hosting/GoTrue evidence.`);
}finally{global.fetch=realFetch;http.request=originalRequest;dns.lookup=originalLookup;await new Promise(r=>edge.close(r));await new Promise(r=>upstream.close(r));rmSync(out,{recursive:true,force:true});}
