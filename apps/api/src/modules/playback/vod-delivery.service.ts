import { Injectable, ForbiddenException, NotFoundException, ServiceUnavailableException, ConflictException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../../prisma.service';
import { StorageService } from '../../common/storage.service';
import { EntitlementService } from '../entitlement/entitlement.service';
import { RightsService } from '../rights/rights.service';
import { verifyGeo } from '../../common/trusted-geo';
import { requireOrganization } from '../../common/organization-license';
import { rewriteVod, vodRelative } from './vod-manifest';

@Injectable()
export class VodDeliveryService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService, private readonly entitlement: EntitlementService, private readonly rights: RightsService) {}
  private key(): string { const key=process.env.VOD_SIGNING_KEY; if (!key || key.length<32) throw new ServiceUnavailableException('VOD_DELIVERY_NOT_CONFIGURED'); return key; }
  private async context(userId: string, titleId: string, req: Request) {
    if (process.env.VOD_DELIVERY_ENABLED!=='true' || process.env.API_END_USER_AUTHORITY!=='supabase') throw new ServiceUnavailableException('VOD_DELIVERY_NOT_CONFIGURED');
    this.key();
    const token=req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    let sessionId: string;
    try { const claims=JSON.parse(Buffer.from(token!.split('.')[1],'base64url').toString()); sessionId=claims.session_id; if(claims.sub!==userId || !/^[a-f0-9-]{36}$/i.test(sessionId)) throw new Error(); } catch { throw new ForbiddenException('SUPABASE_SESSION_REQUIRED'); }
    const rows=await this.prisma.$queryRaw<Array<{active:boolean}>>`SELECT EXISTS(SELECT 1 FROM auth.sessions WHERE id=${sessionId}::uuid AND user_id=${userId}::uuid AND (not_after IS NULL OR not_after>now())) AS active`;
    if(!rows[0]?.active)throw new ForbiddenException('SUPABASE_SESSION_REVOKED');
    const geo=verifyGeo(req.headers['x-external-geo'],`vod:${titleId}`,token!);
    return { binding:createHash('sha256').update(sessionId).digest('hex'), geo };
  }
  private async policy(userId:string,profileId:string,deviceId:string,titleId:string,episodeId:string|undefined,country:string) {
    const user=await this.prisma.appUser.findUnique({where:{id:userId},select:{tenantId:true,status:true}});
    if(!user || user.status!=='active')throw new ForbiddenException('ACCOUNT_INACTIVE');
    await requireOrganization(this.prisma,user.tenantId);
    const profile=await this.prisma.profile.findFirst({where:{id:profileId,userId}});
    const device=await this.prisma.device.findFirst({where:{id:deviceId,userId,revokedAt:null}});
    const title=await this.prisma.title.findFirst({where:{id:titleId,tenantId:user.tenantId,state:'PUBLISHED'}});
    if(!profile||!device||!title)throw new NotFoundException('Playback owner not found');
    const ratings=['G','PG','PG-13','R','NC-17'];
    if(!ratings.includes(profile.maturityMax)||!ratings.includes(title.maturityRating)||ratings.indexOf(title.maturityRating)>ratings.indexOf(profile.maturityMax))throw new ForbiddenException('MATURITY_RESTRICTED');
    if(episodeId&&!await this.prisma.episode.findFirst({where:{id:episodeId,titleId,state:'PUBLISHED'}}))throw new NotFoundException('Episode not found');
    await this.rights.checkRights(titleId,country);
    return user;
  }
  private sign(sessionId:string,relative:string,expiry:number) {
    const payload=Buffer.from(relative).toString('base64url');
    const sig=createHmac('sha256',this.key()).update(`${sessionId}:${payload}:${expiry}`).digest('base64url');
    return `/playback/sessions/${sessionId}/media?resource=${payload}&expires=${expiry}&signature=${sig}`;
  }
  async create(userId:string,profileId:string,deviceId:string,titleId:string,episodeId:string|undefined,req:Request) {
    const context=await this.context(userId,titleId,req);
    await this.policy(userId,profileId,deviceId,titleId,episodeId,context.geo.country);
    const asset=await this.prisma.mediaAsset.findFirst({where:{titleId:episodeId?undefined:titleId,episodeId:episodeId||null,status:'ACTIVE'},orderBy:{createdAt:'desc'}});
    if(!asset || asset.drmContentId || asset.hlsManifestKey!==`hls/${asset.id}/master.m3u8`)throw new ServiceUnavailableException('VOD_ASSET_NOT_READY');
    const session=await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const now=new Date();
      // Stale VOD sessions must not consume a permanent stream slot.
      await tx.playbackSession.updateMany({where:{userId,endedAt:null,vodExpiresAt:{lte:now}},data:{endedAt:now}});
      const access=await this.entitlement.check(userId,profileId,deviceId,titleId,episodeId);
      if(!access.allowed)throw new ConflictException('PLAYBACK_ENTITLEMENT_DENIED');
      // Creation assertions are single-use across replicas.
      await tx.externalGeoNonce.create({data:{id:context.geo.nonce,expiresAt:new Date(context.geo.expiresAt)}});
      return tx.playbackSession.create({data:{userId,profileId,deviceId,titleId,episodeId,vodAssetId:asset.id,vodCountry:context.geo.country,authBinding:context.binding,vodExpiresAt:new Date(Date.now()+4*3600000),positionSec:access.resumeAtSec}});
    });
    return { sessionId:session.id, manifestUrl:this.sign(session.id,'master.m3u8',session.vodExpiresAt!.getTime()), expiresAt:session.vodExpiresAt, nextHeartbeatInSec:30, resumeAtSec:session.positionSec };
  }
  async read(userId:string,id:string,req:Request) {
    const session=await this.prisma.playbackSession.findFirst({where:{id,userId,endedAt:null}});
    if(!session?.vodAssetId || !session.vodExpiresAt || session.vodExpiresAt.getTime()<=Date.now())throw new ForbiddenException('VOD_SESSION_EXPIRED');
    const context=await this.context(userId,session.titleId,req);
    if(session.vodCountry!==context.geo.country)throw new ForbiddenException('VOD_GEO_CONTEXT_CHANGED');
    if(session.authBinding!==context.binding)throw new ForbiddenException('VOD_SESSION_BINDING_MISMATCH');
    const payload=req.query.resource,expires=req.query.expires,signature=req.query.signature;
    if(typeof payload!=='string'||payload.length>1024||typeof expires!=='string'||!/^\d{13}$/.test(expires)||typeof signature!=='string'||signature.length>100||Number(expires)>session.vodExpiresAt.getTime()||Number(expires)<=Date.now())throw new ForbiddenException('INVALID_VOD_RESOURCE');
    const expected=createHmac('sha256',this.key()).update(`${id}:${payload}:${expires}`).digest(),actual=Buffer.from(signature,'base64url');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new ForbiddenException('INVALID_VOD_RESOURCE');
    try{await this.prisma.externalGeoNonce.create({data:{id:context.geo.nonce,expiresAt:new Date(context.geo.expiresAt)}});}catch{throw new ForbiddenException('GEO_REPLAY_DENIED');}
    const relative=vodRelative(Buffer.from(payload,'base64url').toString());
    const authorize=async()=>{
      await this.policy(userId,session.profileId,session.deviceId,session.titleId,session.episodeId||undefined,context.geo.country);
      const stillActive=await this.prisma.playbackSession.findFirst({where:{id,userId,endedAt:null,vodExpiresAt:{gt:new Date()}}});
      if(!stillActive)throw new ForbiddenException('VOD_SESSION_EXPIRED');
      const asset=await this.prisma.mediaAsset.findFirst({where:{id:session.vodAssetId!,status:'ACTIVE',titleId:session.episodeId?undefined:session.titleId,episodeId:session.episodeId||null}});
      if(!asset||asset.drmContentId)throw new ForbiddenException('VOD_ASSET_UNAVAILABLE');
      if(process.env.FREE_ACCESS==='false'&&!await this.prisma.subscription.findFirst({where:{userId,status:'ACTIVE',currentPeriodEnd:{gt:new Date()},plan:{active:true,tenantId:(await this.prisma.appUser.findUniqueOrThrow({where:{id:userId}})).tenantId}}}))throw new ForbiddenException('SUBSCRIPTION_REQUIRED');
    };
    await authorize();
    const data=await this.storage.downloadBounded(`hls/${session.vodAssetId}/${relative}`,relative.endsWith('.m3u8')?1024*1024:16*1024*1024);
    // Revocation during an origin read must not leak already-fetched bytes.
    await authorize();
    if(relative.endsWith('.m3u8'))return { data:Buffer.from(rewriteVod(data.toString('utf8'),relative,key=>this.sign(id,key,Number(expires)))), contentType:'application/vnd.apple.mpegurl' };
    return {data,contentType:relative.endsWith('.ts')?'video/mp2t':relative.endsWith('.vtt')?'text/vtt':relative.endsWith('.aac')?'audio/aac':'video/mp4'};
  }
}
