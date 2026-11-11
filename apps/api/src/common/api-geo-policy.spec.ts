import {createHash,createHmac,randomUUID} from 'node:crypto';
import {ApiGeoPolicyService,apiGeoScope} from './api-geo-policy.service';
describe('central opt-in global API Geo policy (not Auth issuance or actual ingress)',()=>{
 const key='isolated-global-api-geo-signing-key',user=randomUUID(),sid=randomUUID();let env:NodeJS.ProcessEnv,anchor:{id:string}|undefined;
 let query:jest.Mock,create:jest.Mock,service:ApiGeoPolicyService;
 const token='header.'+Buffer.from(JSON.stringify({sub:user,session_id:sid})).toString('base64url')+'.verified-by-guard';
 function request(patch={},scope=apiGeoScope('GET','/profiles')){const now=Date.now(),p=Buffer.from(JSON.stringify({channelId:scope,tokenHash:createHash('sha256').update(token).digest('hex'),country:'IQ',ipHash:'a'.repeat(64),platform:'web',issuedAt:now,expiresAt:now+30000,nonce:randomUUID(),...patch})).toString('base64url');return {method:'GET',url:'/profiles',originalUrl:'/profiles',headers:{'x-api-geo':p+'.'+createHmac('sha256',key).update(p).digest('base64url'),'x-country':'IQ','x-forwarded-for':'8.8.8.8'}} as never;}
 beforeEach(()=>{env={...process.env};process.env.API_GEO_ALLOWED_COUNTRIES='IQ,US';process.env.EXTERNAL_GEO_SIGNING_KEY=key;anchor=undefined;
  query=jest.fn().mockResolvedValue([{createdAt:new Date(),notAfter:null}]);create=jest.fn(async({data})=>{if(data.id.startsWith('api-session:'))anchor={id:data.id};return data;});
  const tx={$executeRaw:jest.fn(),externalGeoNonce:{findFirst:jest.fn(async()=>anchor),create}};
  service=new ApiGeoPolicyService({$queryRaw:query,$transaction:async(fn:(x:unknown)=>unknown)=>fn(tx)} as never);
 });
 afterEach(()=>{for(const k of ['API_GEO_ALLOWED_COUNTRIES','EXTERNAL_GEO_SIGNING_KEY'])if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];});
 it('requires explicit rollout policy and does not pretend unset is enforcement',async()=>{delete process.env.API_GEO_ALLOWED_COUNTRIES;await service.require(request(),user,token);expect(query).not.toHaveBeenCalled();});
 it('binds request method/path, token, live session and durable context',async()=>{await service.require(request(),user,token);expect(anchor).toBeDefined();await service.require(request(),user,token);expect(create).toHaveBeenCalledTimes(3);});
 it.each([{country:'DE'},{ipHash:undefined},{ipHash:'8.8.8.8'},{expiresAt:0},{platform:'tv'}])('denies invalid geography %j',async patch=>{await expect(service.require(request(patch),user,token)).rejects.toThrow();});
 it('rejects same-session country or IP change even if both countries allowed',async()=>{await service.require(request(),user,token);await expect(service.require(request({country:'US'}),user,token)).rejects.toThrow('API_GEO_CONTEXT_CHANGED');await expect(service.require(request({ipHash:'b'.repeat(64)}),user,token)).rejects.toThrow('API_GEO_CONTEXT_CHANGED');});
 it.each([apiGeoScope('POST','/profiles'),apiGeoScope('GET','/other')])('rejects replay against different method/path %s',async scope=>{await expect(service.require(request({},scope),user,token)).rejects.toThrow();});
 it('rejects inactive or over-four-hour authoritative sessions',async()=>{query.mockResolvedValue([]);await expect(service.require(request(),user,token)).rejects.toThrow('API_GEO_SESSION_EXPIRED');});
 it('fails closed when the session database is unavailable',async()=>{query.mockRejectedValue(new Error());await expect(service.require(request(),user,token)).rejects.toThrow('API_GEO_AUTHORITY_UNAVAILABLE');});
 it('rejects absent signed provenance despite client country/IP headers',async()=>{await expect(service.require({method:'GET',url:'/profiles',headers:{'x-country':'IQ','x-forwarded-for':'8.8.8.8'}} as never,user,token)).rejects.toThrow('TRUSTED_GEO_REQUIRED');});
 it('retains transactional nonce replay denial',async()=>{create.mockRejectedValue({code:'P2002'});await expect(service.require(request(),user,token)).rejects.toThrow('API_GEO_REPLAY_DENIED');});
 it('does not misclassify general database failure as bad credentials',async()=>{create.mockRejectedValue(new Error());await expect(service.require(request(),user,token)).rejects.toThrow('API_GEO_AUTHORITY_UNAVAILABLE');});
});
