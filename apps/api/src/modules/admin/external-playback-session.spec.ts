import {createHash,createHmac,randomUUID} from 'node:crypto';
import {verifyGeo} from './external-playback-session.service';
import {mediaRange} from './external-media-range';
describe('protected playback request context',()=>{
 const key='isolated-geo-signing-key-for-unit-tests';let previous:string|undefined;
 const channel=randomUUID(),token='verified-token-fixture';
 beforeEach(()=>{previous=process.env.EXTERNAL_GEO_SIGNING_KEY;process.env.EXTERNAL_GEO_SIGNING_KEY=key;});
 afterEach(()=>{if(previous===undefined)delete process.env.EXTERNAL_GEO_SIGNING_KEY;else process.env.EXTERNAL_GEO_SIGNING_KEY=previous;});
 function sign(patch={}){const now=Date.now(),payload=Buffer.from(JSON.stringify({channelId:channel,tokenHash:createHash('sha256').update(token).digest('hex'),country:'IQ',platform:'web',issuedAt:now,expiresAt:now+30000,nonce:randomUUID(),...patch})).toString('base64url');return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');}
 it('accepts a signed fresh token/channel-bound request',()=>{expect(verifyGeo(sign(),channel,token).country).toBe('IQ');});
 it.each([undefined,'IQ','bad.signature','a.b.c'])('rejects unsigned or malformed context %s',value=>{expect(()=>verifyGeo(value,channel,token)).toThrow('TRUSTED_GEO_REQUIRED');});
 it.each([{country:'iq'},{platform:'tv'},{expiresAt:0},{issuedAt:0},{issuedAt:Date.now()+90000},{nonce:'fixed'},{tokenHash:'wrong'},{channelId:randomUUID()}])('rejects invalid scope %j',patch=>{expect(()=>verifyGeo(sign(patch),channel,token)).toThrow();});
 it('rejects missing key, changed signature and another bearer',()=>{expect(()=>verifyGeo(sign(),channel,'other')).toThrow();expect(()=>verifyGeo(sign()+'x',channel,token)).toThrow();delete process.env.EXTERNAL_GEO_SIGNING_KEY;expect(()=>verifyGeo(sign(),channel,token)).toThrow();});
});
describe('bounded buffered media ranges',()=>{
 it.each([['bytes=0-9',0,9],['bytes=90-',90,99],['bytes=-10',90,99],['bytes=90-900',90,99],['bytes=-1000',0,99]])('supports %s',(value,start,end)=>{expect(mediaRange(value,100)).toEqual({start,end});});
 it.each(['bytes=100-','bytes=9-0','bytes=-0','bytes=-','bytes=0-1,4-5','other=0-1','bytes=90071992547409930-'])('rejects %s',value=>{expect(()=>mediaRange(value,100)).toThrow();});
 it('preserves full media without Range',()=>expect(mediaRange(undefined,100)).toBeNull());
});

describe('safe structured playback observations',()=>{
 it('rejects unknown event labels and nonfinite/user-controlled durations',async()=>{
  const {Logger}=await import('@nestjs/common');const spy=jest.spyOn(Logger.prototype,'log').mockImplementation(()=>{});
  const {playbackMetric}=await import('./external-playback-metrics');
  try{playbackMetric('https://private/token=secret',1);playbackMetric('startup',Infinity);playbackMetric('startup',-1);expect(spy).not.toHaveBeenCalled();playbackMetric('segment_delivery',12.4,206);expect(JSON.parse(spy.mock.calls[0][0])).toEqual({event:'segment_delivery',value:12,status:206});}finally{spy.mockRestore();}
 });
});

describe('declared unsupported media codecs',()=>{
 it.each(['hvc1.1.6.L93.B0','av01.0.04M.08','vp09.00.10.08','mp4a.40.5'])('refuses HLS %s',async codec=>{
  const {parseHls}=await import('./external-policy');expect(parseHls(`#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=200000,CODECS="${codec}"\nvariant.m3u8`,new URL('https://fixture.example/a.m3u8')).result).toBe('unsupported_codec');
 });
});

describe('playback cleanup scheduler safety',()=>{
 let original:string|undefined;
 beforeEach(()=>{original=process.env.EXTERNAL_PLAYBACK_CLEANUP_ENABLED;jest.useFakeTimers();});
 afterEach(()=>{if(original===undefined)delete process.env.EXTERNAL_PLAYBACK_CLEANUP_ENABLED;else process.env.EXTERNAL_PLAYBACK_CLEANUP_ENABLED=original;jest.useRealTimers();jest.restoreAllMocks();});
 it('does not start housekeeping without explicit operator opt-in',async()=>{
  delete process.env.EXTERNAL_PLAYBACK_CLEANUP_ENABLED;
  const {ExternalPlaybackSessionService}=await import('./external-playback-session.service');
  const service=new ExternalPlaybackSessionService({} as never),tick=jest.spyOn(service,'expireBatch');service.onModuleInit();jest.advanceTimersByTime(120000);expect(tick).not.toHaveBeenCalled();await service.onModuleDestroy();
 });
 it('runs bounded housekeeping automatically and stops on shutdown',async()=>{
  process.env.EXTERNAL_PLAYBACK_CLEANUP_ENABLED='true';
  const {ExternalPlaybackSessionService}=await import('./external-playback-session.service');
  const service=new ExternalPlaybackSessionService({} as never),tick=jest.spyOn(service,'expireBatch').mockResolvedValue({expired:1,nonces:1,skipped:false});service.onModuleInit();await jest.advanceTimersByTimeAsync(60000);expect(tick).toHaveBeenCalledTimes(1);await service.onModuleDestroy();await jest.advanceTimersByTimeAsync(60000);expect(tick).toHaveBeenCalledTimes(1);
 });
});

describe('fresh Geo on every protected media authorization',()=>{
 const previous=process.env.EXTERNAL_GEO_SIGNING_KEY;
 const key='isolated-fresh-geo-unit-signing-key',id=randomUUID(),session=randomUUID(),user={id:randomUUID(),tenantId:randomUUID(),profiles:[]};
 const token='fixture.'+Buffer.from(JSON.stringify({session_id:session})).toString('base64url')+'.fixture';
 function assertion(patch={}){const now=Date.now(),p=Buffer.from(JSON.stringify({channelId:id,tokenHash:createHash('sha256').update(token).digest('hex'),country:'IQ',platform:'web',issuedAt:now,expiresAt:now+30000,nonce:randomUUID(),...patch})).toString('base64url');return p+'.'+createHmac('sha256',key).update(p).digest('base64url');}
 beforeEach(()=>{process.env.EXTERNAL_GEO_SIGNING_KEY=key;});
 afterAll(()=>{if(previous===undefined)delete process.env.EXTERNAL_GEO_SIGNING_KEY;else process.env.EXTERNAL_GEO_SIGNING_KEY=previous;});
 async function authorize(value:unknown){
  const {ExternalPlaybackSessionService}=await import('./external-playback-session.service');
  const lease={id:randomUUID(),country:'IQ',platform:'web',revokedAt:null,expiresAt:new Date(Date.now()+120000),absoluteExpiresAt:new Date(Date.now()+3600000)};
  const service=new ExternalPlaybackSessionService({externalPlaybackLease:{findFirst:jest.fn().mockResolvedValue(lease)}} as never);
  jest.spyOn(service,'assertSupabaseSession').mockResolvedValue();
  return service.require(user,id,lease.id,{headers:{authorization:'Bearer '+token,'x-external-geo':value,'x-forwarded-for':'8.8.8.8','x-vercel-ip-country':'IQ'}} as never);
 }
 it('allows fresh signed same-country context after authoritative session check',async()=>{expect((await authorize(assertion())).country).toBe('IQ');});
 it.each([undefined,'IQ','forged.signature',['conflicting','headers']])('rejects direct or forged context even with country/IP headers',async value=>{await expect(authorize(value)).rejects.toThrow('TRUSTED_GEO_REQUIRED');});
 it.each([{country:'US'},{platform:'tv'},{expiresAt:1},{tokenHash:'different'},{channelId:randomUUID()}])('rejects changed/expired/mismatched media context',async patch=>{await expect(authorize(assertion(patch))).rejects.toThrow();});
});

describe('unsupported encrypted HLS fails closed before resource minting',()=>{
 it.each(['METHOD=AES-128,URI="key"','URI="key",METHOD=AES-128','METHOD = AES-128,URI="key"','METHOD=NONE,URI="key"','URI="key"'])('rejects key declaration %s',async value=>{
  const {parseHls}=await import('./external-policy');expect(parseHls(`#EXTM3U\n#EXT-X-KEY:${value}\n#EXTINF:2,\nseg.ts`,new URL('https://fixture.example/a.m3u8')).result).toBe('drm_protected');
 });
});
