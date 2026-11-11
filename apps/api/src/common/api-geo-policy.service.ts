import {Injectable,ForbiddenException,HttpException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import type {Request} from 'express';
import {PrismaService} from '../prisma.service';
import {verifyGeo} from './trusted-geo';
export function apiGeoScope(method:string,url:string):string{return 'api:'+method.toUpperCase()+':'+createHash('sha256').update(url).digest('hex');}
/** Explicit approved policy rollout only. Absence is NOT global Geo enforcement
 * and remains a release blocker. Existing content/media policy never falls back
 * to this switch. No production configuration/schema/Auth mutation here. */
@Injectable()
export class ApiGeoPolicyService{
 constructor(private readonly prisma:PrismaService){}
 async require(req:Request,userId:string,token:string){
  const raw=process.env.API_GEO_ALLOWED_COUNTRIES;
  if(raw===undefined)return;
  const countries=raw.split(',').map(v=>v.trim());
  if(!countries.length||countries.some(v=>!/^[A-Z]{2}$/.test(v)))throw new HttpException('API_GEO_POLICY_INVALID',503);
  const geo=verifyGeo(req.headers['x-api-geo'],apiGeoScope(req.method,req.originalUrl||req.url),token);
  if(!countries.includes(geo.country)||!geo.ipHash||!/^[a-f0-9]{64}$/.test(geo.ipHash))throw new ForbiddenException('API_GEO_DENIED');
  let session:string;
  try{const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());session=claims.session_id;if(claims.sub!==userId||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(session))throw new Error();}catch{throw new ForbiddenException('SUPABASE_SESSION_REQUIRED');}
  // Claims were verified by Auth before this call. Session liveness/age comes
  // from Auth's own database, never a browser-issued country/IP or JWT alone.
  let rows:Array<{createdAt:Date;notAfter:Date|null}>;
  try{rows=await this.prisma.$queryRaw<Array<{createdAt:Date;notAfter:Date|null}>>`SELECT created_at AS "createdAt",not_after AS "notAfter" FROM auth.sessions WHERE id=${session}::uuid AND user_id=${userId}::uuid AND (not_after IS NULL OR not_after>now()) AND created_at>now()-interval '4 hours'`;}catch{throw new HttpException('API_GEO_AUTHORITY_UNAVAILABLE',503);}
  if(!rows.length)throw new ForbiddenException('API_GEO_SESSION_EXPIRED');
  const expiresAt=new Date(Math.min(rows[0].createdAt.getTime()+4*3600000,rows[0].notAfter?.getTime()??Infinity));
  const prefix='api-session:'+createHash('sha256').update(userId+':'+session).digest('hex')+':';
  const anchor=prefix+createHash('sha256').update(geo.country+':'+geo.ipHash).digest('hex');
  try{
   await this.prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
    const previous=await tx.externalGeoNonce.findFirst({where:{id:{startsWith:prefix}}});
    if(previous&&previous.id!==anchor)throw new ForbiddenException('API_GEO_CONTEXT_CHANGED');
    if(!previous)await tx.externalGeoNonce.create({data:{id:anchor,expiresAt}});
    await tx.externalGeoNonce.create({data:{id:geo.nonce,expiresAt:new Date(geo.expiresAt)}});
   });
  }catch(error){if(error instanceof ForbiddenException)throw error;if((error as {code?:string}).code==='P2002')throw new ForbiddenException('API_GEO_REPLAY_DENIED');throw new HttpException('API_GEO_AUTHORITY_UNAVAILABLE',503);}
 }
}
