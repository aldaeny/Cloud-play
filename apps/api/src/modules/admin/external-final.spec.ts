import { ExternalPlaybackSessionService } from './external-playback-session.service';
import { createHmac } from 'node:crypto';
import { ExternalPlaybackController, playbackScope } from './external-playback.controller';
import { ExternalChannelsService } from './external-channels.service';
import { XtreamServersService } from './xtream-servers.service';
import { validateEvidence, scanEvidence } from './external-evidence';
import { parseDash, parseM3u, expandTemplate } from './external-manifests';
import * as transport from '../../common/pinned-provider-request';
import type { Request,Response } from 'express';

describe('strict supported manifest profiles',()=>{
 const base=new URL('https://fixture.example/live/manifest.mpd');
 const mpd=(inner:string)=>`<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"><Period><AdaptationSet><Representation id="0">${inner}</Representation></AdaptationSet></Period></MPD>`;
 it('parses SegmentList and templates without network/XML entities',()=>{
  expect(parseDash(mpd('<SegmentList><Initialization sourceURL="init.mp4"/><SegmentURL media="a.mp4"/></SegmentList>'),base).result).toBe('reachable_and_dash_valid');
  expect(parseDash(mpd('<SegmentTemplate initialization="init-$RepresentationID$.mp4" media="s-$Number%05d$.mp4"/>'),base).result).toBe('reachable_and_dash_valid');
  expect(expandTemplate('s-$RepresentationID$-$Number%05d$-$Time$.mp4','0',2,10)).toBe('s-0-00002-10.mp4');
 });
 it.each(['<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><MPD/>',mpd('<BaseURL>https://other.example/</BaseURL><SegmentTemplate media="a.mp4"/>'),mpd('<SegmentTemplate media="http://127.0.0.1/a.mp4"/>'),'<MPD><bad>'])('fails closed for unsupported/unsafe XML%s',value=>expect(()=>parseDash(value,base)).toThrow());
 it('flags ContentProtection instead of retrieving keys',()=>expect(parseDash(mpd('<ContentProtection schemeIdUri="drm"/>'),base).result).toBe('drm_protected'));
 it('validates M3U references without declaring decoded playback',()=>{
  expect(parseM3u('#EXTM3U\n#EXTINF:-1,Synthetic\nstream.m3u8',base).references).toHaveLength(1);
  expect(()=>parseM3u('#EXTM3U\n#EXTINF:-1,Private\nhttp://127.0.0.1/a',base)).toThrow();
 });
});
describe('confidential evidence quarantine and dangerous-file denial',()=>{
 it.each([['text/plain',Buffer.from('MZexecutable')],['text/plain',Buffer.from('#!/bin/sh\nexit 0')],['text/plain',Buffer.from('<svg onload="attack"/>')],['application/pdf',Buffer.from('%PDF-1.4 /JavaScript (attack) %%EOF')],['image/png',Buffer.from('fake PNG')]])('rejects unsafe%s',(mime,bytes)=>expect(()=>validateEvidence(bytes,mime)).toThrow());
 it('does not mark files clean when no scanner is configured',async()=>{const saved=process.env.EXTERNAL_DOCUMENT_SCANNER_PATH;delete process.env.EXTERNAL_DOCUMENT_SCANNER_PATH;try{expect(await scanEvidence(Buffer.from('synthetic'))).toBe('quarantine');}finally{if(saved!==undefined)process.env.EXTERNAL_DOCUMENT_SCANNER_PATH=saved;}});
});
describe('per-request playback rights boundary and source/user-bound opaque addressing',()=>{
 const user={id:'11111111-1111-4111-8111-111111111111',tenantId:'22222222-2222-4222-8222-222222222222',profiles:[]};
 const channel='33333333-3333-4333-8333-333333333333';
 const key='isolated-context-signing-fixture-only';
 let previous:string|undefined;
 beforeEach(()=>{previous=process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY;process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY=key;});
 afterEach(()=>{if(previous===undefined)delete process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY;else process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY=previous;jest.restoreAllMocks();});
 function assertion(patch={}){const payload=Buffer.from(JSON.stringify({userId:user.id,tenantId:user.tenantId,channelId:channel,country:'IQ',platform:'web',expiresAt:Date.now()+60000,...patch})).toString('base64url');return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');}
 function fixture(){
  const selected=jest.fn().mockResolvedValue({id:'source-fixture',server:{endpointEncrypted:'endpoint-fixture'}});
  // Test-only reversible address codec. Actual AES-GCM/DB isolation is separately tested.
  const vault={decryptSecret:(value:string)=>value==='endpoint-fixture'?'https://fixture.example/manifest.m3u8':Buffer.from(value,'base64url').toString(),encryptSecret:jest.fn((value:string)=>Buffer.from(value).toString('base64url'))};
  const controller=new ExternalPlaybackController({selected,channel:jest.fn().mockResolvedValue({failureThreshold:1}),playbackFailure:jest.fn()} as unknown as ExternalChannelsService,vault as unknown as XtreamServersService,{require:jest.fn().mockResolvedValue({id:'lease-fixture',country:'IQ',platform:'web',absoluteExpiresAt:new Date(Date.now()+300000)})} as unknown as ExternalPlaybackSessionService);
  const res={setHeader:jest.fn(),type:jest.fn(),send:jest.fn(),status:jest.fn(),json:jest.fn()};res.status.mockReturnValue(res);
  return {controller,selected,encrypt:vault.encryptSecret,res:res as unknown as Response,send:res.send};
 }
 it('rejects missing, forged, expired, wrong-user or wrong-tenant country assertions',()=>{
  expect(()=>playbackScope(undefined,user,channel)).toThrow();
  expect(()=>playbackScope(assertion()+'.forged',user,channel)).toThrow();
  for(const patch of [{expiresAt:0},{userId:'other'},{tenantId:'other'},{channelId:'other'}])expect(()=>playbackScope(assertion(patch),user,channel)).toThrow();
 });
 it('rewrites manifests without provider URLs and rechecks selection before each send',async()=>{
  const f=fixture();jest.spyOn(transport,'pinnedProviderRequest').mockResolvedValue(new globalThis.Response('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nsegment.ts',{headers:{'content-type':'application/vnd.apple.mpegurl'}}));
  await f.controller.start(user,channel,{headers:{'x-external-context':assertion()}} as unknown as Request,f.res);
  const body=f.send.mock.calls[0][0] as string;expect(body).not.toContain('https://fixture.example');expect(f.selected).toHaveBeenCalledTimes(3);
  const url=new URL(body.split('\n').pop()!,'https://api.fixture');
  await expect(f.controller.resource({...user,id:'different-user'},channel,url.searchParams.get('ticket')!,undefined,undefined,undefined,{headers:{}} as Request,f.res)).rejects.toThrow('INVALID_MEDIA_RESOURCE');
 });
 it('keeps repeated resource addresses identical for implicit HLS byte ranges',async()=>{
  const f=fixture();jest.spyOn(transport,'pinnedProviderRequest').mockResolvedValue(new globalThis.Response('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\n#EXT-X-BYTERANGE:10@0\nsegment.ts\n#EXTINF:1,\n#EXT-X-BYTERANGE:10\nsegment.ts',{headers:{'content-type':'application/vnd.apple.mpegurl'}}));
  await f.controller.start(user,channel,{headers:{}} as Request,f.res);
  const resources=(f.send.mock.calls[0][0] as string).split('\n').filter(line=>line.startsWith('/external-playback/'));expect(resources).toHaveLength(2);expect(resources[0]).toBe(resources[1]);expect(f.encrypt).toHaveBeenCalledTimes(1);
 });
 it('normalizes relative and absolute same-origin references to protected addresses',async()=>{
  const f=fixture();jest.spyOn(transport,'pinnedProviderRequest').mockResolvedValue(new globalThis.Response('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nsegment.ts\n#EXTINF:1,\nhttps://fixture.example/segment.ts',{headers:{'content-type':'application/vnd.apple.mpegurl'}}));
  await f.controller.start(user,channel,{headers:{}} as Request,f.res);
  const body=f.send.mock.calls[0][0] as string;expect(body).not.toContain('fixture.example');expect(f.encrypt).toHaveBeenCalledTimes(1);
 });
 it('does not echo provider origins or unexpected URI syntax hidden in manifest metadata',async()=>{
  for(const suffix of ['#provider https://fixture.example/private',"#EXT-X-MEDIA:TYPE=AUDIO,URI='https://fixture.example/audio.m3u8'"]){
   const f=fixture();jest.spyOn(transport,'pinnedProviderRequest').mockResolvedValue(new globalThis.Response('#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nsegment.ts\n'+suffix,{headers:{'content-type':'application/vnd.apple.mpegurl'}}));
   await expect(f.controller.start(user,channel,{headers:{'x-external-context':assertion()}} as unknown as Request,f.res)).rejects.toThrow();expect(f.send).not.toHaveBeenCalled();jest.restoreAllMocks();
  }
 });
 it('a revoke/source denial while bytes are fetching prevents the response',async()=>{
  const f=fixture();f.selected.mockResolvedValueOnce({id:'source-fixture',server:{endpointEncrypted:'endpoint-fixture'}}).mockResolvedValueOnce({id:'source-fixture',server:{endpointEncrypted:'endpoint-fixture'}}).mockRejectedValueOnce(new Error('RIGHTS_REVOKED'));
  jest.spyOn(transport,'pinnedProviderRequest').mockResolvedValue(new globalThis.Response(Buffer.alloc(188),{headers:{'content-type':'video/mp2t'}}));
  await expect(f.controller.start(user,channel,{headers:{'x-external-context':assertion()}} as unknown as Request,f.res)).rejects.toThrow('RIGHTS_REVOKED');expect(f.send).not.toHaveBeenCalled();
 });
});
