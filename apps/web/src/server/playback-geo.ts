import {createHash,createHmac,randomUUID} from 'node:crypto';
import type {NextApiRequest} from 'next';
/** Vercel overwrites x-vercel-ip-country at its ingress. Enable ONLY on the
 * actual Vercel runtime, with no alternate path around that ingress. Setting
 * this flag on a custom server does not make client headers trustworthy. */
export function signHostingGeo(req:NextApiRequest,channelId:string,token:string):string{
 const key=process.env.EXTERNAL_GEO_SIGNING_KEY;
 if(process.env.VERCEL!=='1'||process.env.EXTERNAL_TRUST_VERCEL_GEO!=='true'||!key||key.length<32)throw new Error('TRUSTED_GEO_UNAVAILABLE');
 const country=req.headers['x-vercel-ip-country'];
 if(typeof country!=='string'||!/^[A-Z]{2}$/.test(country))throw new Error('TRUSTED_GEO_UNAVAILABLE');
 const issuedAt=Date.now();
 const payload=Buffer.from(JSON.stringify({channelId,tokenHash:createHash('sha256').update(token).digest('hex'),country,platform:'web',issuedAt,expiresAt:issuedAt+30000,nonce:randomUUID()})).toString('base64url');
 return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');
}
