// Actual browser -> Next routes -> Nest guard -> GoTrue + PostgreSQL -> TLS media.
// Hosting metadata is injected by an ISOLATED edge fixture, never Vercel evidence.
import assert from 'node:assert/strict';
import {createServer,request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash,createHmac,randomUUID,randomBytes} from 'node:crypto';
import path from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
const require=createRequire(import.meta.url);
export async function testProtectedAuthPlayback({app,prisma,tenant,userId,session,certDir,refreshToken,otherSessionToken}){
 const root=path.resolve(''),media=process.env.MEDIA_FIXTURES;
 if(!media||!process.env.AUTH_TEST_DATABASE_URL?.includes('127.0.0.1:5439'))throw new Error('ISOLATED_AUTH_MEDIA_REQUIRED');
 const tlsOptions={key:await readFile(path.join(certDir,'key.pem')),cert:await readFile(path.join(certDir,'cert.pem'))};
 const transport=require('../dist/common/pinned-provider-request.js'),original=transport.pinnedProviderRequest;
 process.env.XTREAM_ENCRYPTION_KEY=randomBytes(32).toString('hex');
 const vault=app.get(require('../dist/modules/admin/xtream-servers.service.js').XtreamServersService);
 const channels=app.get(require('../dist/modules/admin/external-channels.service.js').ExternalChannelsService);
 const request=require('supertest');const key='isolated-request-geo-key-at-least-32-characters';process.env.EXTERNAL_GEO_SIGNING_KEY=key;
 let mediaServer,apiServer,edge,next,browser;const fixtures=[];let checks=0;let secondUserId;let stage='synthetic_setup';let transientDrops=0;
 const pass=label=>{checks++;console.log('PASS protected authenticated playback: '+label);};
 try{
  mediaServer=createServer(tlsOptions,async(req,res)=>{
   try{const url=new URL(req.url,'https://fixture.example');if(url.pathname.endsWith('.ts')&&transientDrops===0){transientDrops++;res.destroy();return;}if(url.pathname.includes('..'))throw new Error();const file=path.join(media,url.pathname);if(!file.startsWith(path.resolve(media)+path.sep))throw new Error();let data;
    if(url.pathname==='/hls/byterange.m3u8'){
      const first=await readFile(path.join(media,'hls/low0.ts')),second=await readFile(path.join(media,'hls/low1.ts'));
      data=Buffer.from(`#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2,\n#EXT-X-BYTERANGE:${first.length}@0\nrange.ts\n#EXTINF:2,\n#EXT-X-BYTERANGE:${second.length}\nrange.ts\n#EXT-X-ENDLIST\n`);
    }else if(url.pathname==='/hls/range.ts')data=Buffer.concat([await readFile(path.join(media,'hls/low0.ts')),await readFile(path.join(media,'hls/low1.ts'))]);
    else data=await readFile(file);
    const ext=path.extname(file);
    if(url.pathname==='/hls/master.m3u8')data=Buffer.from(data.toString().replace('high.m3u8','https://fixture.example/hls/high.m3u8')+'#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=1000,URI="byterange.m3u8"\n');
    if(ext==='.mpd')data=Buffer.from(data.toString().replace(/initialization="([^"]+)"/g,'initialization="https://fixture.example/$1"'));
    res.setHeader('content-type',({'.m3u8':'application/vnd.apple.mpegurl','.mpd':'application/dash+xml','.ts':'video/mp2t','.m4s':'video/mp4','.mp4':'video/mp4','.vtt':'text/vtt'})[ext]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}
  });await new Promise(resolve=>mediaServer.listen(0,'127.0.0.1',resolve));
  const deps={lookup:async()=>[{address:'8.8.8.8',family:4}],request:(url,opts,done)=>httpsRequest(url,{...opts,port:mediaServer.address().port,ca:tlsOptions.cert,servername:undefined,checkServerIdentity:(_host,cert)=>require('node:tls').checkServerIdentity('127.0.0.1',cert),lookup:(_name,options,cb)=>options.all?cb(null,[{address:'127.0.0.1',family:4}]):cb(null,'127.0.0.1',4)},done)};
  transport.pinnedProviderRequest=(url,init,_deps,limit,allowHttp,trace)=>{assert.equal(url.hostname,'fixture.example','no external provider contact');return original(url,init,deps,limit,allowHttp,trace);};
  for(const [name,file,protocol] of [['alsharqiya','hls/master.m3u8','hls'],['alsharqiya-news','manifest.mpd','dash']]){
   const group=await channels.createGroup(tenant,userId,{name:'Isolated browser '+name});
   const channel=await channels.createChannel(tenant,userId,{groupId:group.id,name:'Synthetic '+name,country:'IQ',platform:'web'});
   const license=await prisma.contentLicense.create({data:{tenantId:tenant,provider:name,contentOwner:'Synthetic fixture author',authorizedContact:'fixture@example.invalid',authorizationType:'synthetic',allowedPlatforms:['web'],allowedCountries:['IQ'],commercialUse:true,redistributionPermission:true,territoryRestrictions:'IQ',startDate:new Date(0),expiryDate:new Date('2099-01-01'),status:'verified_authorized',reviewedBy:userId,reviewDate:new Date()}});
   const server=await prisma.externalServer.create({data:{tenantId:tenant,name:'Synthetic '+name,providerName:name,protocol,endpointEncrypted:vault.encryptSecret('https://fixture.example/'+file),country:'IQ',category:'synthetic',licenseId:license.id,lastCheckedAt:new Date()}});
   await prisma.serverHealthCheck.create({data:{tenantId:tenant,serverId:server.id,startedAt:new Date(),finishedAt:new Date(),result:protocol==='hls'?'reachable_and_hls_valid':'reachable_and_dash_valid',details:{segmentStatus:'fetched_mime_valid'}}});
   const source=await channels.addSource(tenant,userId,channel.id,{serverId:server.id,priority:1});
   await channels.approveSource(tenant,userId,channel.id,source.id,{publicationApproved:true});
   await channels.activate(tenant,userId,channel.id,{enabled:true,publicationApproved:true});
   fixtures.push({name,channel,license,server,group});
  }
  const token=session.access_token;
  const geo=(channelId,bearer=token,patch={})=>{const issuedAt=Date.now(),value=Buffer.from(JSON.stringify({channelId,tokenHash:createHash('sha256').update(bearer).digest('hex'),country:'IQ',platform:'web',issuedAt,expiresAt:issuedAt+30000,nonce:randomUUID(),...patch})).toString('base64url');return value+'.'+createHmac('sha256',key).update(value).digest('base64url');};
  stage='second_actual_auth_user';
  // A second independently authenticated GoTrue user (not a mocked principal).
  const adminPart=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({role:'service_role',aud:'authenticated',exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
  const adminToken=adminPart+'.'+createHmac('sha256','isolated-fixture-signing-key-not-for-any-production-use').update(adminPart).digest('base64url');
  const secondEmail='playback-'+randomUUID()+'@example.invalid',secondPassword=randomUUID()+'Aa1!';
  const adminCreated=await fetch('http://127.0.0.1:9999/admin/users',{method:'POST',headers:{Authorization:`Bearer ${adminToken}`,'Content-Type':'application/json'},body:JSON.stringify({email:secondEmail,password:secondPassword,email_confirm:true})});assert.equal(adminCreated.status,200);
  secondUserId=(await adminCreated.json()).id;await prisma.appUser.create({data:{id:secondUserId,tenantId:tenant,status:'active'}});
  const secondLogin=await fetch('http://127.0.0.1:9999/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:secondEmail,password:secondPassword})});assert.equal(secondLogin.status,200);const secondToken=(await secondLogin.json()).access_token;
  const base='/external-playback/'+fixtures[0].channel.id;
  stage='geo_lease_security';
  const create=(assertion)=>request(app.getHttpServer()).post(base+'/session').set('Authorization',`Bearer ${token}`).set('x-external-geo',assertion);
  await create('unsigned').expect(403);await create(geo(fixtures[0].channel.id,token,{expiresAt:1})).expect(403);
  const assertion=geo(fixtures[0].channel.id),lease=await create(assertion).expect(201);
  await create(assertion).expect(403);
  const races=await Promise.all([1,2,3,4].map(()=>create(geo(fixtures[0].channel.id))));assert.equal(races.filter(r=>r.status===201).length,1);assert.equal(races.filter(r=>r.status===429).length,3);
  const get=(url,id=lease.body.id,bearer=token)=>request(app.getHttpServer()).get(url).set('Authorization',`Bearer ${bearer}`).set('x-playback-session',id);
  await get(base+'/manifest').expect(200);await get(base+'/manifest',lease.body.id,secondToken).expect(403);await get(base+'/manifest',lease.body.id,otherSessionToken).expect(403);await get('/external-playback/'+fixtures[1].channel.id+'/manifest').expect(403);
  await request(app.getHttpServer()).put(base+'/session').set('Authorization',`Bearer ${token}`).set('x-playback-session',lease.body.id).set('x-external-geo',geo(fixtures[0].channel.id)).expect(200);
  await prisma.externalPlaybackLease.update({where:{id:lease.body.id},data:{expiresAt:new Date(0)}});
  await get(base+'/manifest').expect(403);
  await request(app.getHttpServer()).put(base+'/session').set('Authorization',`Bearer ${token}`).set('x-playback-session',lease.body.id).set('x-external-geo',geo(fixtures[0].channel.id)).expect(403);
  await prisma.externalPlaybackLease.updateMany({where:{userId},data:{revokedAt:new Date()}});
  pass('real GoTrue/PG: cross-user and same-user cross-session reuse denied; unsigned/expired/replayed geo denied; four racing creates enforce limit; renewal, expiry and cross-channel denial');
  stage='next_https_startup';
  apiServer=createServer(tlsOptions,app.getHttpAdapter().getInstance());await new Promise(resolve=>apiServer.listen(9444,'127.0.0.1',resolve));
  // This proxy models a trusted ingress and overwrites country. It does NOT
  // claim a real hosting-provider integration was exercised.
  edge=createServer(tlsOptions,(req,res)=>{
   const auth=req.url.startsWith('/auth/v1/');const upstream=httpRequest({hostname:'127.0.0.1',port:auth?9999:3101,path:auth?req.url.replace('/auth/v1',''):req.url,method:req.method,headers:{...req.headers,'x-vercel-ip-country':'IQ'}},out=>{res.writeHead(out.statusCode,out.headers);out.pipe(res);});upstream.on('error',()=>{res.writeHead(503);res.end();});req.pipe(upstream);
  });await new Promise(resolve=>edge.listen(9445,'127.0.0.1',resolve));
  next=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',path.join(root,'apps/web'),'--hostname','127.0.0.1','--port','3101'],{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'https://127.0.0.1:9445',NEXT_PUBLIC_SUPABASE_ANON_KEY:'isolated-gateway-fixture',API_INTERNAL_URL:'https://127.0.0.1:9444',EXTERNAL_PUBLIC_ORIGIN:'https://127.0.0.1:9445',VERCEL:'1',EXTERNAL_TRUST_VERCEL_GEO:'true',EXTERNAL_GEO_SIGNING_KEY:key,EXTERNAL_CHANNEL_BINDINGS:JSON.stringify(Object.fromEntries(fixtures.map(f=>[f.name,f.channel.id]))),EXTERNAL_CHANNEL_FORMATS:JSON.stringify({'alsharqiya-news':'dash'})},stdio:'ignore'});
  let ready=false;for(let i=0;i<90;i++){if(next.exitCode!==null)throw new Error('NEXT_FIXTURE_EXITED');try{if((await fetch('https://127.0.0.1:9445/tv-sources',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await wait(1000);}assert.ok(ready,'Next fixture ready');
  const {chromium}=await import('playwright-core');browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  await context.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'?route.continue():route.abort();});
  await context.addInitScript(value=>localStorage.setItem('sb-cloudplay-auth',JSON.stringify(value)),{...session,expires_at:JSON.parse(Buffer.from(token.split('.')[1],'base64url')).exp});
  const page=await context.newPage();let mediaRequests=0;
  page.on('request',req=>{if(req.url().includes('/api/external/')&&req.url().includes('/resource'))mediaRequests++;});
  for(const [width,name] of [[1280,'alsharqiya'],[390,'alsharqiya-news']]){
   await page.setViewportSize({width,height:900});await page.goto('https://127.0.0.1:9445/tv-sources',{waitUntil:'domcontentloaded'});
   stage='hls_browser_decode';
   await page.locator('#'+name+' .ptv-open').click();
   const video=page.locator('video').first();await video.waitFor();await video.evaluate(v=>{v.muted=true;void v.play().catch(()=>{});});
   await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.currentTime>1&&v.videoWidth>0;},null,{timeout:60000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
   assert.equal(transientDrops,1,'actual dropped TLS segment request recovered by bounded backend retry');
   const cookie=await context.cookies();assert.ok(cookie.some(c=>c.name==='__Host-cloudplay-lease'&&c.httpOnly&&c.secure));
   assert.ok(!(await page.content()).includes('fixture.example'));
   pass(`actual existing player decoded ${name==='alsharqiya'?'HLS':'DASH'} at ${width}px via Next/Nest/GoTrue/PG/TLS with a dropped segment request recovered; no provider URL in HTML`);
   // Force network interruption and restore before lease TTL expires.
   await context.setOffline(true);await wait(300);await context.setOffline(false);
   const before=await video.evaluate(v=>v.currentTime);await page.waitForFunction(value=>document.querySelector('video')?.currentTime>value+0.1,before,{timeout:20000});
   stage='hls_resource_authorization_and_ranges';
   // Exercise every HLS resource class independently via the real bridge.
   const rootPath='https://127.0.0.1:9445';
   const masterResponse=await context.request.get(rootPath+'/api/external/'+name+'/manifest');assert.equal(masterResponse.status(),200);
   const master=await masterResponse.text();const variant=master.split('\n').find(line=>line.startsWith('/api/external/'));
   const variantResponse=await context.request.get(rootPath+variant);assert.equal(variantResponse.status(),200);
   const variantText=await variantResponse.text(),segment=variantText.split('\n').find(line=>line.startsWith('/api/external/'));
   const range=await context.request.get(rootPath+segment,{headers:{Range:'bytes=0-9'}});assert.equal(range.status(),206);assert.equal((await range.body()).length,10);assert.match(range.headers()['content-range'],/^bytes 0-9\//);
   const rangePlaylist=master.split('\n').find(line=>line.startsWith('#EXT-X-I-FRAME-STREAM-INF:')).match(/URI="([^"]+)"/)[1];
   const rangePlaylistResponse=await context.request.get(rootPath+rangePlaylist);assert.equal(rangePlaylistResponse.status(),200);const rangeText=await rangePlaylistResponse.text();
   const repeated=rangeText.split('\n').filter(line=>line.startsWith('/api/external/'));assert.equal(repeated.length,2);assert.equal(repeated[0],repeated[1],'implicit byte-range offsets retain identical resource addresses');
   const firstLength=Number(rangeText.match(/#EXT-X-BYTERANGE:(\d+)@0/)[1]);const secondLength=Number(rangeText.match(/#EXT-X-BYTERANGE:(\d+)\n/)[1]);
   for(const [start,length] of [[0,firstLength],[firstLength,secondLength]]){const part=await context.request.get(rootPath+repeated[0],{headers:{Range:`bytes=${start}-${start+length-1}`}});assert.equal(part.status(),206);assert.equal((await part.body()).length,length);}
   const subtitlePlaylist=master.split('\n').find(line=>line.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES')).match(/URI="([^"]+)"/)[1];
   const subtitleResponse=await context.request.get(rootPath+subtitlePlaylist);assert.equal(subtitleResponse.status(),200);const subtitleSegment=(await subtitleResponse.text()).split('\n').find(line=>line.startsWith('/api/external/'));
   assert.equal((await context.request.get(rootPath+subtitleSegment)).status(),200);
   // Revoke the stored lease without clearing its cookies; next request denies.
   const currentCookie=(await context.cookies()).find(c=>c.name==='__Host-cloudplay-lease');
   await prisma.externalPlaybackLease.update({where:{id:currentCookie.value},data:{revokedAt:new Date()}});
   assert.equal((await context.request.get('https://127.0.0.1:9445/api/external/'+name+(name==='alsharqiya'?'/manifest':'/manifest.mpd'))).status(),403);
   pass('browser brief offline/online buffered playback continues; independently revoked DB lease denies subsequent manifest with cookies retained');
   for(const resource of [variant,segment,subtitlePlaylist,subtitleSegment])assert.equal((await context.request.get(rootPath+resource)).status(),403);
   await page.close();
   // New page/context session is needed for the other synthetic channel.
   if(name==='alsharqiya'){await context.close();break;}
  }
  // Separate context ensures no reused per-page lifecycle and tests DASH too.
  stage='dash_browser_decode';
  const dashContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
  await dashContext.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await dashContext.addInitScript(value=>localStorage.setItem('sb-cloudplay-auth',JSON.stringify(value)),{...session,expires_at:JSON.parse(Buffer.from(token.split('.')[1],'base64url')).exp});
  const dashPage=await dashContext.newPage();const dashResources=new Set();dashPage.on('request',req=>{if(req.url().includes('/api/external/')&&req.url().includes('/resource'))dashResources.add(req.url());});await dashPage.goto('https://127.0.0.1:9445/tv-sources',{waitUntil:'domcontentloaded'});await dashPage.locator('#alsharqiya-news .ptv-open').click();
  await dashPage.locator('video').first().evaluate(v=>{v.muted=true;void v.play().catch(()=>{});});
  await dashPage.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.currentTime>1&&v.videoWidth>0;},null,{timeout:60000});
  assert.ok(await dashPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));pass('actual existing DASH player decoded fMP4 init/media at 390px through authenticated bridge');
  assert.ok(mediaRequests>0);assert.ok(dashResources.size>=2,'DASH initialization and media requested');
  stage='real_entitlement_revocation';
  await prisma.contentLicense.update({where:{id:fixtures[1].license.id},data:{status:'revoked'}});
  for(const url of [...dashResources].slice(0,4)){const denied=await dashContext.request.get(url);assert.ok(denied.status()>=400);}
  await prisma.contentLicense.update({where:{id:fixtures[1].license.id},data:{status:'verified_authorized'}});
  pass('actual GoTrue-backed entitlement revocation blocks subsequent DASH init/media requests');
  const dashCookie=(await dashContext.cookies()).find(c=>c.name==='__Host-cloudplay-lease');
  // Actual token rotation, same Supabase session_id preserves an active lease.
  stage='real_refresh_rotation_and_logout';
  const rotated=await fetch('http://127.0.0.1:9999/token?grant_type=refresh_token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});assert.equal(rotated.status,200);const fresh=await rotated.json();
  assert.equal(JSON.parse(Buffer.from(fresh.access_token.split('.')[1],'base64url')).session_id,JSON.parse(Buffer.from(token.split('.')[1],'base64url')).session_id);
  await request(app.getHttpServer()).put('/external-playback/'+fixtures[1].channel.id+'/session').set('Authorization',`Bearer ${fresh.access_token}`).set('x-playback-session',dashCookie.value).set('x-external-geo',geo(fixtures[1].channel.id,fresh.access_token)).expect(200);
  const logout=await fetch('http://127.0.0.1:9999/logout?scope=local',{method:'POST',headers:{Authorization:`Bearer ${fresh.access_token}`}});assert.equal(logout.status,204);
  const afterLogout=await request(app.getHttpServer()).get('/external-playback/'+fixtures[1].channel.id+'/manifest').set('Authorization',`Bearer ${fresh.access_token}`).set('x-playback-session',dashCookie.value);
  assert.ok([401,403].includes(afterLogout.status),'logout must deny whether GoTrue rejects JWT or authoritative session row is absent');
  pass('actual refresh-token rotation renews same-session lease; real GoTrue logout immediately denies still-signed access JWT');
  await dashContext.close();
  return checks;
 }catch(error){
  const status=String(error?.message||'').match(/expected (\d{3})[^\n]*got (\d{3})/);
  console.log('::error title=Protected playback stage::'+stage+(status?'; expected '+status[1]+' got '+status[2]:''));
  throw error;
 }finally{
  await browser?.close();if(next){next.kill('SIGTERM');await Promise.race([new Promise(resolve=>next.once('exit',resolve)),wait(5000)]);if(next.exitCode===null)next.kill('SIGKILL');}
  for(const server of [edge,apiServer,mediaServer])if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  transport.pinnedProviderRequest=original;
  await prisma.externalPlaybackLease.deleteMany({where:{userId}});
  if(secondUserId)await prisma.appUser.delete({where:{id:secondUserId}});
  for(const f of fixtures){await prisma.externalChannel.update({where:{id:f.channel.id},data:{activeSourceId:null}});await prisma.externalFailoverEvent.deleteMany({where:{channelId:f.channel.id}});await prisma.channelSource.deleteMany({where:{channelId:f.channel.id}});await prisma.externalChannel.delete({where:{id:f.channel.id}});await prisma.providerGroup.delete({where:{id:f.group.id}});await prisma.serverHealthCheck.deleteMany({where:{serverId:f.server.id}});await prisma.externalServer.delete({where:{id:f.server.id}});await prisma.licenseReview.deleteMany({where:{licenseId:f.license.id}});await prisma.contentLicense.delete({where:{id:f.license.id}});}
 }
}
