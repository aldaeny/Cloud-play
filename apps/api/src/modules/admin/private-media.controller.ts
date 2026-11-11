import {Controller, Post, Req, UseGuards, ForbiddenException, HttpException, Logger} from '@nestjs/common';
import type {Request} from 'express';
import {SupabaseAuthGuard} from '../../common/supabase-auth.guard';
import {CurrentUser, UserRequest} from '../../common/permissions.decorator';
import {ExternalPlaybackSessionService, verifyGeo} from './external-playback-session.service';
import {PrismaService} from '../../prisma.service';

/** Authorization only: no provider URL, credentials or client identity accepted.
 * Next invokes this over the configured internal TLS origin for EVERY resource.
 * Auth /user alone does not prove a still-live Supabase session after logout. */
@Controller('private-media')
@UseGuards(SupabaseAuthGuard)
export class PrivateMediaController {
 constructor(private readonly sessions:ExternalPlaybackSessionService,private readonly prisma:PrismaService){}
 @Post('authorize')
 async authorize(@CurrentUser() user:UserRequest,@Req() req:Request){
  const owners=(process.env.XTREAM_OWNER_USER_IDS||'').split(',').map(v=>v.trim().toLowerCase());
  if(!owners.includes(user.id.toLowerCase()))throw new ForbiddenException('NOT_AUTHORIZED');
  const token=req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1]||'';
  // Claims are read only AFTER SupabaseAuthGuard verifies the exact bearer.
  let claims:{session_id:string;exp:number;sub:string};
  try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
   if(claims.sub!==user.id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)||!Number.isSafeInteger(claims.exp)||claims.exp*1000<=Date.now())throw new Error();
  }catch{throw new ForbiddenException('SUPABASE_SESSION_REQUIRED');}
  await this.sessions.assertSupabaseSession(user,claims.session_id);
  const geo=verifyGeo(req.headers['x-external-geo'],'private-media',token);
  if(typeof geo.ipHash!=='string'||!/^[a-f0-9]{64}$/.test(geo.ipHash))throw new ForbiddenException('TRUSTED_IP_REQUIRED');
  const allowed=(process.env.PRIVATE_MEDIA_ALLOWED_COUNTRIES||'').split(',').map(v=>v.trim());
  if(!allowed.length||allowed.some(v=>!/^[A-Z]{2}$/.test(v)))throw new HttpException('GEO_POLICY_NOT_CONFIGURED',503);
  if(!allowed.includes(geo.country))throw new ForbiddenException('COUNTRY_NOT_ALLOWED');
  // Transactional cross-replica replay denial, same bounded expiry cleanup as
  // external playback; no new table, user, schema or production migration.
  try{await this.prisma.externalGeoNonce.create({data:{id:geo.nonce,expiresAt:new Date(geo.expiresAt)}});}catch{throw new ForbiddenException('GEO_REPLAY_DENIED');}
  new Logger('PrivateMedia').log(JSON.stringify({event:'private_media_authorization',status:200}));
  return {userId:user.id,sessionId:claims.session_id,country:geo.country,ipHash:geo.ipHash,expiresAt:Math.min(claims.exp*1000,Date.now()+4*3600000)};
 }
}
