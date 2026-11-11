import {ForbiddenException} from '@nestjs/common';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export type GeoEnvelope = { channelId:string; tokenHash:string; country:string; ipHash?:string; platform:'web'; issuedAt:number; expiresAt:number; nonce:string };
/** A request assertion, NOT a media ticket. Replay ledger is transactional PostgreSQL. */
export function verifyGeo(value:unknown, channelId:string, token:string, now=Date.now()):GeoEnvelope {
  const key=process.env.EXTERNAL_GEO_SIGNING_KEY;
  try{
    if(!key||key.length<32||typeof value!=='string'||value.length>2000)throw new Error();
    const parts=value.split('.');if(parts.length!==2)throw new Error();
    const expected=createHmac('sha256',key).update(parts[0]).digest(),sig=Buffer.from(parts[1],'base64url');
    if(sig.length!==expected.length||!timingSafeEqual(expected,sig))throw new Error();
    const geo=JSON.parse(Buffer.from(parts[0],'base64url').toString()) as GeoEnvelope;
    if(geo.channelId!==channelId||geo.tokenHash!==createHash('sha256').update(token).digest('hex')||!/^[A-Z]{2}$/.test(geo.country)||geo.platform!=='web'||!Number.isSafeInteger(geo.issuedAt)||!Number.isSafeInteger(geo.expiresAt)||geo.issuedAt>now+1000||geo.issuedAt<now-30000||geo.expiresAt<=now||geo.expiresAt>geo.issuedAt+30000||!/^[a-f0-9-]{36}$/.test(geo.nonce))throw new Error();
    return geo;
  }catch{throw new ForbiddenException('TRUSTED_GEO_REQUIRED');}
}
