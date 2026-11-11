import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import type {NextApiRequest} from 'next';
/** Vercel overwrites x-vercel-ip-country at its ingress. Enable ONLY on the
 * actual Vercel runtime, with no alternate path around that ingress. Setting
 * this flag on a custom server does not make client headers trustworthy. */
export function signHostingGeo(req:NextApiRequest,channelId:string,token:string,requireIp=false):string{
 const key=process.env.EXTERNAL_GEO_SIGNING_KEY;
 if(!key||key.length<32)throw new Error('TRUSTED_GEO_UNAVAILABLE');
 const selfhost=process.env.SELFHOST_TRUST_MTLS_EDGE==='true';
 if(!selfhost&&(process.env.VERCEL!=='1'||process.env.EXTERNAL_TRUST_VERCEL_GEO!=='true'))throw new Error('TRUSTED_GEO_UNAVAILABLE');
 const edge=selfhost?verifySelfhostEdge(req):undefined;
 const country=edge?.country??req.headers['x-vercel-ip-country'];
 if(typeof country!=='string'||!/^[A-Z]{2}$/.test(country))throw new Error('TRUSTED_GEO_UNAVAILABLE');
 // Vercel's dedicated ingress header, never XFF/X-Real-IP chosen by the client.
 // Only this platform-specific boundary may assert it. Hosted overwrite proof
 // remains a release gate; setting VERCEL on a custom server is not provenance.
 const raw=edge?.ip??req.headers['x-vercel-forwarded-for'];let ipHash:string|undefined;
 if(typeof raw==='string'&&isIP(raw)&&!raw.includes('%')){
  const canonical=isIP(raw)===6?new URL('http://['+raw+']/').hostname.toLowerCase():raw;
  ipHash=createHmac('sha256',key).update('private-media-ip:'+canonical).digest('hex');
 }else if(requireIp)throw new Error('TRUSTED_IP_UNAVAILABLE');
 const issuedAt=Date.now();
 const payload=Buffer.from(JSON.stringify({channelId,tokenHash:createHash('sha256').update(token).digest('hex'),country,...(ipHash?{ipHash}:{}),platform:'web',issuedAt,expiresAt:issuedAt+30000,nonce:randomUUID()})).toString('base64url');
 return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');
}

export function apiGeoHeaders(req:NextApiRequest,method:string,path:string,token:string):Record<string,string>{
 if(process.env.API_GEO_ENFORCEMENT!=='true')return {};
 const scope='api:'+method.toUpperCase()+':'+createHash('sha256').update(path).digest('hex');
 return {'x-api-geo':signHostingGeo(req,scope,token,true)};
}

/** Authenticated private gateway only. Generic forwarding/country headers are ignored.
 * Install the gateway with a private web listener, dedicated client CA and key.
 * Envelopes bind the request path, method and complete credential transport.
 */
export function verifySelfhostEdge(req:NextApiRequest):{country:string;ip:string}{
 try{
  const key=process.env.SELFHOST_EDGE_SECRET,value=req.headers['x-cloudplay-edge'];
  if(!key||key.length<32||typeof value!=='string'||value.length>4096)throw new Error();
  const parts=value.split('.');if(parts.length!==2)throw new Error();
  const actual=Buffer.from(parts[1],'base64url'),expected=createHmac('sha256',key).update(parts[0]).digest();
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error();
  const edge=JSON.parse(Buffer.from(parts[0],'base64url').toString()),now=Date.now();
  const credentialHash=createHash('sha256').update((req.headers.authorization||'')+'\0'+(req.headers.cookie||'')).digest('hex');
  if(edge.method!==req.method||edge.url!==req.url||edge.credentialHash!==credentialHash||!Number.isSafeInteger(edge.issuedAt)||!Number.isSafeInteger(edge.expiresAt)||edge.issuedAt>now+1000||edge.issuedAt<now-5000||edge.expiresAt<=now||edge.expiresAt>edge.issuedAt+5000||typeof edge.country!=='string'||!/^[A-Z]{2}$/.test(edge.country)||typeof edge.ip!=='string'||!isIP(edge.ip)||edge.ip.includes('%')||typeof edge.nonce!=='string'||!/^[a-f0-9-]{36}$/.test(edge.nonce))throw new Error();
  return {country:edge.country,ip:edge.ip};
 }catch{throw new Error('AUTHENTICATED_SELFHOST_EDGE_REQUIRED');}
}
