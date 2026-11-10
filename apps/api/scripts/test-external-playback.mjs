import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer, request as httpsRequest } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
export async function testExternalPlayback(client,tenant,channel,licenses,check){
 await check('actual Nest/DB/TLS synthetic playback: URL rewriting, resource user binding, scope checks and revocation during fetch (identity fixture)',async()=>{
  const temp=await mkdtemp(path.join(tmpdir(),'external-playback-'));
  const oldContext=process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY;process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY=randomUUID();
  const transport=require('../dist/common/pinned-provider-request.js'),original=transport.pinnedProviderRequest;
  let server,app,revoke=false;
  try{
   execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(temp,'key'),'-out',path.join(temp,'cert'),'-days','1','-subj','/CN=fixture.example','-addext','subjectAltName=DNS:fixture.example'],{stdio:'ignore'});
   const cert=await readFile(path.join(temp,'cert')),key=await readFile(path.join(temp,'key'));
   server=createServer({cert,key},async(req,res)=>{
    if(req.url==='/stream.m3u8'){res.setHeader('content-type','application/vnd.apple.mpegurl');return res.end('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nsegment.ts\n');}
    if(revoke)await client.contentLicense.update({where:{id:licenses[0].id},data:{status:'revoked'}});
    res.setHeader('content-type','video/mp2t');res.end(Buffer.alloc(188,0x47));
   });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   const deps={lookup:async()=>[{address:'8.8.8.8',family:4}],request:(url,opts,done)=>httpsRequest(url,{...opts,port:server.address().port,ca:cert,lookup:(_name,options,cb)=>options.all?cb(null,[{address:'127.0.0.1',family:4}]):cb(null,'127.0.0.1',4)},done)};
   transport.pinnedProviderRequest=(url,init,_deps,limit,allowHttp,trace)=>{assert.equal(url.hostname,'fixture.example');return original(url,init,deps,limit,allowHttp,trace);};
   const {Test}=require('@nestjs/testing'),{AppModule}=require('../dist/app.module.js'),{PrismaService}=require('../dist/prisma.service.js'),{SupabaseAuthGuard}=require('../dist/common/supabase-auth.guard.js');
   const user={id:randomUUID(),tenantId:tenant.id,profiles:[]};
   // Explicit identity fixture. Real GoTrue verification remains a separate CI job.
   const mod=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(PrismaService).useValue(client).overrideGuard(SupabaseAuthGuard).useValue({canActivate(context){const req=context.switchToHttp().getRequest();req.user={...user,...(req.headers['x-fixture-other-user']?{id:randomUUID()}:{})};return true;}}).compile();
   app=mod.createNestApplication({logger:false});await app.init();
   const request=require('supertest');
   const assertion=(patch={})=>{const value=Buffer.from(JSON.stringify({userId:user.id,tenantId:tenant.id,channelId:channel.id,country:'IQ',platform:'web',expiresAt:Date.now()+60000,...patch})).toString('base64url');return value+'.'+createHmac('sha256',process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY).update(value).digest('base64url');};
   const url=`/external-playback/${channel.id}/manifest`;
   await request(app.getHttpServer()).get(url).expect(403);
   await request(app.getHttpServer()).get(url).set('x-external-context',assertion({country:'US'})).expect(403);
   const manifest=await request(app.getHttpServer()).get(url).set('x-external-context',assertion()).buffer(true).parse((res,done)=>{let body='';res.on('data',chunk=>body+=chunk.toString());res.on('end',()=>done(null,body));}).expect(200);
   assert.ok(!manifest.body.includes('https://fixture.example'));assert.equal(manifest.headers['cache-control'],'private, no-store');
   const resource=manifest.body.split('\n').find(line=>line.startsWith('/external-playback/'));
   const segment=await request(app.getHttpServer()).get(resource).expect(200);assert.equal(segment.body.length,188);
   await request(app.getHttpServer()).get(resource).set('x-fixture-other-user','true').expect(403);
   revoke=true;
   const blocked=await request(app.getHttpServer()).get(resource);assert.ok(blocked.status>=400);assert.ok(blocked.body?.length!==188);
  }finally{
   transport.pinnedProviderRequest=original;
   await client.contentLicense.update({where:{id:licenses[0].id},data:{status:'verified_authorized'}});
   await app?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
   if(oldContext===undefined)delete process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY;else process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY=oldContext;
   await rm(temp,{recursive:true,force:true});
  }
 });
}
