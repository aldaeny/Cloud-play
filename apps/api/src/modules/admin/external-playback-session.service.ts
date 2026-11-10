import {playbackMetric} from './external-playback-metrics';
import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../../prisma.service';
import type { UserRequest } from '../../common/permissions.decorator';

export type GeoEnvelope = { channelId:string; tokenHash:string; country:string; platform:'web'; issuedAt:number; expiresAt:number; nonce:string };
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
/** Called ONLY after SupabaseAuthGuard verified this bearer. Never an auth verifier. */
function binding(req:Request):{token:string;binding:string;sessionId:string}{
  try{
    const token=req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];if(!token)throw new Error();
    const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
    if(typeof claims.session_id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(claims.session_id))throw new Error();
    return {token,sessionId:claims.session_id as string,binding:createHash('sha256').update(claims.session_id).digest('hex')};
  }catch{throw new ForbiddenException('SUPABASE_SESSION_REQUIRED');}
}
@Injectable()
export class ExternalPlaybackSessionService {
 constructor(private readonly prisma:PrismaService){}
 /** Supabase /user can accept an access JWT after logout. Check the authoritative
  * session row too; deployment role must have narrowly scoped read access. */
 async assertSupabaseSession(user:UserRequest,sessionId:string){
  try{
   const rows=await this.prisma.$queryRaw<Array<{active:boolean}>>`SELECT EXISTS (SELECT 1 FROM auth.sessions WHERE id=${sessionId}::uuid AND user_id=${user.id}::uuid AND (not_after IS NULL OR not_after > now())) AS active`;
   if(!rows[0]?.active)throw new ForbiddenException('SUPABASE_SESSION_REVOKED');
  }catch(error){if(error instanceof ForbiddenException)throw error;throw new HttpException('AUTH_SESSION_CHECK_UNAVAILABLE',503);}
 }
 async create(user:UserRequest,channelId:string,req:Request){
  const auth=binding(req),geo=verifyGeo(req.headers['x-external-geo'],channelId,auth.token);
  await this.assertSupabaseSession(user,auth.sessionId);
  return this.prisma.$transaction(async tx=>{
   // Same per-user lock across all workers: no count-then-create race.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
   await tx.externalGeoNonce.deleteMany({where:{expiresAt:{lt:new Date()}}});
   try{await tx.externalGeoNonce.create({data:{id:geo.nonce,expiresAt:new Date(geo.expiresAt)}});}catch{throw new ForbiddenException('GEO_REPLAY_DENIED');}
   const active=await tx.externalPlaybackLease.count({where:{userId:user.id,revokedAt:null,expiresAt:{gt:new Date()}}});
   const limit=Number(process.env.EXTERNAL_PLAYBACK_CONCURRENT_LIMIT||2);
   if(!Number.isInteger(limit)||limit<1||limit>10)throw new HttpException('PLAYBACK_POLICY_UNAVAILABLE',503);
   if(active>=limit)throw new HttpException('PLAYBACK_CONCURRENCY_LIMIT',429);
   const now=Date.now();return tx.externalPlaybackLease.create({data:{userId:user.id,tenantId:user.tenantId,channelId,authBinding:auth.binding,country:geo.country,platform:geo.platform,expiresAt:new Date(now+120000),absoluteExpiresAt:new Date(now+4*3600000)}});
  });
 }
 async require(user:UserRequest,channelId:string,id:unknown,req:Request){
  if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new ForbiddenException('PLAYBACK_SESSION_REQUIRED');
  const auth=binding(req),lease=await this.prisma.externalPlaybackLease.findFirst({where:{id,userId:user.id,tenantId:user.tenantId,channelId,authBinding:auth.binding}});
  await this.assertSupabaseSession(user,auth.sessionId);
  if(!lease||lease.revokedAt)throw new ForbiddenException('PLAYBACK_SESSION_EXPIRED_OR_REVOKED');
  if(lease.expiresAt.getTime()<=Date.now()||lease.absoluteExpiresAt.getTime()<=Date.now()){playbackMetric('session_expiration',1);throw new ForbiddenException('PLAYBACK_SESSION_EXPIRED_OR_REVOKED');}
  return lease;
 }
 async renew(user:UserRequest,channelId:string,id:unknown,req:Request){
  const lease=await this.require(user,channelId,id,req),auth=binding(req),geo=verifyGeo(req.headers['x-external-geo'],channelId,auth.token);
  if(geo.country!==lease.country||geo.platform!==lease.platform)throw new ForbiddenException('PLAYBACK_CONTEXT_CHANGED');
  return this.prisma.$transaction(async tx=>{
   try{await tx.externalGeoNonce.create({data:{id:geo.nonce,expiresAt:new Date(geo.expiresAt)}});}catch{throw new ForbiddenException('GEO_REPLAY_DENIED');}
   const expiresAt=new Date(Math.min(Date.now()+120000,lease.absoluteExpiresAt.getTime()));
   const result=await tx.externalPlaybackLease.updateMany({where:{id:lease.id,revokedAt:null,expiresAt:{gt:new Date()}},data:{expiresAt}});
   if(result.count!==1)throw new ForbiddenException('PLAYBACK_SESSION_EXPIRED_OR_REVOKED');
   return {id:lease.id,expiresAt};
  });
 }
 async revoke(user:UserRequest,id:unknown){
  if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new ForbiddenException('PLAYBACK_SESSION_REQUIRED');
  await this.prisma.externalPlaybackLease.updateMany({where:{id,userId:user.id,tenantId:user.tenantId,revokedAt:null},data:{revokedAt:new Date()}});
 }
}
