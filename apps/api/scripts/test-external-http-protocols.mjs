// Actual local HTTP sockets with synthetic generated streams. Explicit test-only
// public-DNS -> loopback fixture routing, identical to the isolated TLS harness.
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {pinnedProviderRequest}=require('../dist/common/pinned-provider-request.js');
const {parseDash,parseM3u}=require('../dist/modules/admin/external-manifests.js');
const {parseHls}=require('../dist/modules/admin/external-policy.js');
const root=process.env.MEDIA_FIXTURES;
if(!root||!path.isAbsolute(root))throw new Error('EXPLICIT_SYNTHETIC_FIXTURES_REQUIRED');
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://fixture.example').pathname;
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+'/'))throw new Error();
  const mime=pathname.endsWith('.mpd')?'application/dash+xml':pathname.endsWith('.m3u8')?'application/vnd.apple.mpegurl':pathname.endsWith('.ts')?'video/mp2t':'video/mp4';
  res.setHeader('content-type',mime);res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://fixture.example:${server.address().port}`;
const deps={lookup:async()=>[{address:'8.8.8.8',family:4}],request:(url,opts,done)=>request(url,{...opts,lookup:(_name,options,cb)=>options.all?cb(null,[{address:'127.0.0.1',family:4}]):cb(null,'127.0.0.1',4)},done)};
const get=url=>pinnedProviderRequest(new URL(url),{method:'GET',signal:AbortSignal.timeout(2000)},deps,2*1024*1024,true);
try{
 await assert.rejects(pinnedProviderRequest(new URL(base+'/hls/low.m3u8'),{method:'GET'},deps),{code:'INVALID_URL'});
 const hls=await get(base+'/hls/low.m3u8');const parsed=parseHls(await hls.text(),new URL(base+'/hls/low.m3u8'));assert.equal(parsed.result,'reachable_and_hls_valid');
 const segment=await get(parsed.reference.href);assert.equal(segment.headers.get('content-type'),'video/mp2t');assert.ok((await segment.arrayBuffer()).byteLength>188);
 const mpd=await get(base+'/manifest.mpd');const dash=parseDash(await mpd.text(),new URL(base+'/manifest.mpd'));assert.equal(dash.result,'reachable_and_dash_valid');
 assert.equal((await get(dash.reference.href)).status,200);
 assert.equal(parseM3u('#EXTM3U\n#EXTINF:-1,Synthetic\nhls/low.m3u8',new URL(base+'/channels.m3u')).references.length,1);
 await assert.rejects(pinnedProviderRequest(new URL(base+'/hls/low.m3u8?secret=denied'),{method:'GET'},deps,4096,true),{code:'INVALID_URL'});
 console.log('PASS actual isolated opt-in HTTP: default denied, credentials query denied, generated HLS/segment and DASH/initialization fetched, M3U references validated. This is protocol transport/manifest acceptance, not external provider access or this proxy decoded-video acceptance.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
