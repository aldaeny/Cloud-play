import {createHash,createHmac,randomUUID} from 'node:crypto';
import {PrivateMediaController} from './private-media.controller';
describe('private media live session authorization (unit policy, not ingress proof)',()=>{
 const user={id:randomUUID(),tenantId:randomUUID(),profiles:[]},sessionId=randomUUID(),key='isolated-private-media-geo-signing-key';
 const original={...process.env};let active:jest.Mock,create:jest.Mock,controller:PrivateMediaController;
 const jwt=(patch={})=>'header.'+Buffer.from(JSON.stringify({sub:user.id,session_id:sessionId,exp:Math.floor(Date.now()/1000)+3600,...patch})).toString('base64url')+'.signature';
 const req=(token=jwt(),patch={},signed=true)=>{
  const now=Date.now(),payload=Buffer.from(JSON.stringify({channelId:'private-media',tokenHash:createHash('sha256').update(token).digest('hex'),country:'IQ',platform:'web',ipHash:'a'.repeat(64),issuedAt:now,expiresAt:now+30000,nonce:randomUUID(),...patch})).toString('base64url');
  return {headers:{authorization:'Bearer '+token,'x-external-geo':signed?payload+'.'+createHmac('sha256',key).update(payload).digest('base64url'):'forged','x-forwarded-for':'8.8.8.8','x-country':'IQ'}} as never;
 };
 beforeEach(()=>{process.env.XTREAM_OWNER_USER_IDS=user.id;process.env.PRIVATE_MEDIA_ALLOWED_COUNTRIES='IQ';process.env.EXTERNAL_GEO_SIGNING_KEY=key;
  active=jest.fn().mockResolvedValue(undefined);create=jest.fn().mockResolvedValue({});controller=new PrivateMediaController({assertSupabaseSession:active} as never,{externalGeoNonce:{create}} as never);
 });
 afterEach(()=>{for(const k of ['XTREAM_OWNER_USER_IDS','PRIVATE_MEDIA_ALLOWED_COUNTRIES','EXTERNAL_GEO_SIGNING_KEY']){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}});
 it('returns verified binding only after live session and fresh Geo/replay checks',async()=>{const r=await controller.authorize(user,req());expect(r).toMatchObject({userId:user.id,sessionId,country:'IQ',ipHash:'a'.repeat(64)});expect(active).toHaveBeenCalledWith(user,sessionId);expect(create).toHaveBeenCalledTimes(1);});
 it('rejects removed owner independently of client role',async()=>{process.env.XTREAM_OWNER_USER_IDS=randomUUID();await expect(controller.authorize(user,req())).rejects.toThrow('NOT_AUTHORIZED');});
 it.each([{sub:randomUUID()},{session_id:'missing'},{exp:0},{exp:'9999999999'}])('rejects invalid verified claims %j',async patch=>{await expect(controller.authorize(user,req(jwt(patch)))).rejects.toThrow('SUPABASE_SESSION_REQUIRED');});
 it('denies revoked session even when /user accepted the JWT',async()=>{active.mockRejectedValue(new Error('SUPABASE_SESSION_REVOKED'));await expect(controller.authorize(user,req())).rejects.toThrow('SUPABASE_SESSION_REVOKED');expect(create).not.toHaveBeenCalled();});
 it('fails closed on session authority outage',async()=>{active.mockRejectedValue(new Error('AUTH_SESSION_CHECK_UNAVAILABLE'));await expect(controller.authorize(user,req())).rejects.toThrow('AUTH_SESSION_CHECK_UNAVAILABLE');});
 it('rejects untrusted country and forwarded headers without signed context',async()=>{await expect(controller.authorize(user,req(jwt(),{},false))).rejects.toThrow('TRUSTED_GEO_REQUIRED');});
 it.each([{ipHash:undefined},{ipHash:'8.8.8.8'},{country:'US'},{expiresAt:0},{platform:'tv'}])('denies invalid/context outside policy %j',async patch=>{await expect(controller.authorize(user,req(jwt(),patch))).rejects.toThrow();});
 it('rejects missing country policy rather than opening all territories',async()=>{delete process.env.PRIVATE_MEDIA_ALLOWED_COUNTRIES;await expect(controller.authorize(user,req())).rejects.toThrow('GEO_POLICY_NOT_CONFIGURED');});
 it('denies replay across workers at unique nonce insert',async()=>{create.mockRejectedValue(new Error('duplicate'));await expect(controller.authorize(user,req())).rejects.toThrow('GEO_REPLAY_DENIED');});
});
