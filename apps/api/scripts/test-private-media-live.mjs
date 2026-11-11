// Real production Pages handlers -> actual Nest guard -> isolated GoTrue/native
// PG auth.sessions -> guarded public-to-local fixture sockets. Synthetic DNS/IP
// mapping is an explicit fixture seam, NOT real hosting provenance evidence.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
export async function privateMediaLive({prisma,userId,secondUserId,token,secondToken,otherSessionToken,tlsOptions,apiOrigin,media}){
 if(!process.env.AUTH_TEST_DATABASE_URL?.includes('127.0.0.1:5439')||!apiOrigin.startsWith('https://127.0.0.1:'))throw new Error('ISOLATED_PRIVATE_MEDIA_REQUIRED');
 const out=mkdtempSync(path.resolve('apps/web/.private-live-fixture-')),before={...process.env};
 const require=createRequire(path.join(out,'test.cjs')),https=require('node:https'),dns=require('node:dns/promises');
 const originalRequest=https.request,lookup=dns.lookup;
 let mediaServer,edge,checks=0,stage='compile',interrupt=false;
 const otherSid=JSON.parse(Buffer.from(otherSessionToken.split('.')[1],'base64url')).session_id;
 const pass=label=>{checks++;console.log('PASS protected authenticated playback: private media actual Auth: '+label);};
 try{
  execFileSync(process.execPath,['node_modules/typescript/bin/tsc',...['playlist/import','playlist/stream','xtream/play','xtream/stream','private-media/renew'].map(r=>'apps/web/pages/api/'+r+'.ts'),'--outDir',out,'--module','commonjs','--target','es2022','--esModuleInterop','--skipLibCheck','--strict'],{stdio:'pipe'});
  const handlers=Object.fromEntries(['playlist/import','playlist/stream','xtream/play','xtream/stream','private-media/renew'].map(r=>['/api/'+r,require('./pages/api/'+r+'.js').default]));
  const secret='isolated-live-private-media-secret',geoKey=process.env.EXTERNAL_GEO_SIGNING_KEY;
  Object.assign(process.env,{NODE_ENV:'production',API_INTERNAL_URL:apiOrigin,VERCEL:'1',EXTERNAL_TRUST_VERCEL_GEO:'true',EXTERNAL_GEO_SIGNING_KEY:geoKey,XTREAM_OWNER_USER_IDS:[userId,secondUserId].join(','),PRIVATE_MEDIA_ALLOWED_COUNTRIES:'IQ',PLAYLIST_PROXY_SECRET:secret,XTREAM_PROXY_SECRET:secret,XTREAM_CATALOG_ENABLED:'true',XTREAM_BASE_URL:'https://fixture.example',XTREAM_USERNAME:'synthetic-private-user',XTREAM_PASSWORD:'synthetic-private-password'});
  stage='media_fixture';
  mediaServer=https.createServer(tlsOptions,async(req,res)=>{
   try{
    if(req.url==='/list.m3u')return res.end('#EXTM3U\n#EXTINF:-1 group-title="Preserved group",Preserved channel\nhttps://fixture.example/master.m3u8');
    if(req.url.endsWith('.m3u8')){res.setHeader('content-type','application/vnd.apple.mpegurl');return res.end('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-KEY:METHOD=AES-128,URI="https://fixture.example/key.bin"\n#EXTINF:2,\nhttps://fixture.example/first.ts\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:2,\nhttps://fixture.example/last.ts\n#EXT-X-ENDLIST');}
    if(req.url==='/key.bin')return res.end(Buffer.alloc(16,5));
    if(interrupt){interrupt=false;await prisma.$executeRaw`UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id=${otherSid}::uuid`;}
    res.setHeader('content-type','video/mp2t');return res.end(await readFile(path.join(media,'hls',req.url==='/first.ts'?'low0.ts':'low1.ts')));
   }catch{res.statusCode=500;res.end();}
  });await new Promise(r=>mediaServer.listen(0,'127.0.0.1',r));
  dns.lookup=async()=>[{address:'8.8.8.8',family:4}];
  https.request=(url,options,done)=>{
   if(url.hostname!=='fixture.example')return originalRequest(url,options,done);
   // Still execute the production socket lookup/guard first; only its public
   // result may route to the controlled TLS listener. Auth/internal TLS untouched.
   return originalRequest(url,{...options,port:mediaServer.address().port,ca:tlsOptions.cert,checkServerIdentity:(_host,cert)=>require('node:tls').checkServerIdentity('127.0.0.1',cert),lookup:(h,o,cb)=>options.lookup(h,o,(error,address,family)=>{if(error)return cb(error);const rows=Array.isArray(address)?address:[{address,family}];assert.ok(rows.every(v=>v.address==='8.8.8.8'));if(o.all)cb(null,[{address:'127.0.0.1',family:4}]);else cb(null,'127.0.0.1',4);})},done);
  };
  edge=https.createServer(tlsOptions,async(req,res)=>{
   const u=new URL(req.url,'https://edge');req.query=Object.fromEntries(u.searchParams);req.cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
   req.headers['x-vercel-ip-country']='IQ';req.headers['x-vercel-forwarded-for']='8.8.8.8';
   const chunks=[];for await(const b of req)chunks.push(b);req.body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
   res.status=n=>{res.statusCode=n;return res;};res.json=v=>res.end(JSON.stringify(v));res.send=v=>res.end(v);
   try{await handlers[u.pathname](req,res);}catch{res.statusCode=500;res.end();}
  });await new Promise(r=>edge.listen(0,'127.0.0.1',r));const origin='https://127.0.0.1:'+edge.address().port;process.env.PRIVATE_MEDIA_PUBLIC_ORIGIN=origin;
  const hit=(url,bearer=token,options={})=>fetch(origin+url,{...options,headers:{cookie:`__Host-cloudplay-private=${bearer}`,...options.headers},signal:AbortSignal.timeout(15000)});
  const renew=(url,bearer=token)=>hit('/api/private-media/renew',bearer,{method:'POST',headers:{origin,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify({url})});
  let firstSegment;
  for(const kind of ['playlist','xtream']){
   stage=kind+'_mint';let selection;
   if(kind==='playlist'){
    const r=await hit('/api/playlist/import',token,{method:'POST',headers:{origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({url:'https://fixture.example/list.m3u'})});assert.equal(r.status,200);const b=await r.json();assert.equal(b.data.channels[0].name,'Preserved channel');assert.equal(b.data.channels[0].group,'Preserved group');selection=b.data.channels[0].url;
   }else{const r=await hit('/api/xtream/play?kind=live&id=1',token,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);selection=(await r.json()).url;}
   assert.equal((await hit(selection)).status,403);const exchange=await renew(selection);assert.equal(exchange.status,200);assert.match(exchange.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);const live=(await exchange.json()).url;
   stage=kind+'_resources';const r=await hit(live);assert.equal(r.status,200);const manifest=await r.text();assert.ok(!manifest.includes('fixture.example'));assert.ok(!manifest.includes('synthetic-private-password'));
   const key=manifest.match(/URI="([^"]+)"/)[1],segments=manifest.split('\n').filter(v=>v.startsWith('/api/'));assert.equal(segments.length,2);assert.equal((await(await hit(key)).arrayBuffer()).byteLength,16);
   for(const segment of segments){const bytes=await hit(segment);assert.equal(bytes.status,200);assert.ok((await bytes.arrayBuffer()).byteLength>188);}firstSegment=segments[0];
   assert.equal((await hit(live,'')).status,401);assert.equal((await hit(live,secondToken)).status,403);assert.equal((await hit(live,otherSessionToken)).status,403);assert.equal((await renew(selection,secondToken)).status,403);assert.equal((await renew(selection,otherSessionToken)).status,403);
   pass(kind+': production import/issuance, live exchange, manifest, identity-key transport and last real synthetic segment; cross-user/session/capability-only denial');
  }
  // Real authoritative session-row expiry during fetch must defeat a still-signed
  // JWT. Restore only this isolated fixture row for the subsequent external tests.
  stage='revocation_during_fetch';
  const r=await hit('/api/xtream/play?kind=live&id=1',otherSessionToken,{headers:{Authorization:'Bearer '+otherSessionToken}});assert.equal(r.status,200);const selection=(await r.json()).url;
  const renewal=await renew(selection,otherSessionToken);assert.equal(renewal.status,200);const manifest=await(await hit((await renewal.json()).url,otherSessionToken)).text();const segment=manifest.split('\n').find(x=>x.startsWith('/api/'));
  interrupt=true;assert.equal((await hit(segment,otherSessionToken)).status,403);assert.equal((await renew(selection,otherSessionToken)).status,403);assert.equal((await hit(firstSegment,token)).status,200);
  pass('actual session expiry during upstream fetch prevents response; renewal denied; unrelated live session preserved');
  return checks;
 }catch(error){console.error('PRIVATE_MEDIA_LIVE_FAILED stage='+stage);throw error;}
 finally{
  await prisma.$executeRaw`UPDATE auth.sessions SET not_after=NULL WHERE id=${otherSid}::uuid`;
  https.request=originalRequest;dns.lookup=lookup;
  for(const name of ['NODE_ENV','API_INTERNAL_URL','VERCEL','EXTERNAL_TRUST_VERCEL_GEO','EXTERNAL_GEO_SIGNING_KEY','XTREAM_OWNER_USER_IDS','PRIVATE_MEDIA_ALLOWED_COUNTRIES','PLAYLIST_PROXY_SECRET','XTREAM_PROXY_SECRET','XTREAM_CATALOG_ENABLED','XTREAM_BASE_URL','XTREAM_USERNAME','XTREAM_PASSWORD','PRIVATE_MEDIA_PUBLIC_ORIGIN']){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}
  if(edge)await new Promise(r=>edge.close(r));if(mediaServer)await new Promise(r=>mediaServer.close(r));rmSync(out,{recursive:true,force:true});
 }
}
