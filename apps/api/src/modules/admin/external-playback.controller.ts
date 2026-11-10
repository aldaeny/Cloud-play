import { mediaRange } from './external-media-range';
import { ExternalPlaybackMetricsInterceptor, playbackMetric } from './external-playback-metrics';
import { ExternalPlaybackSessionService, verifyGeo } from './external-playback-session.service';
import { Body, UseInterceptors, Controller, Delete, Post, Put, ForbiddenException, Get, Header, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { SupabaseAuthGuard } from '../../common/supabase-auth.guard';
import { CurrentUser, UserRequest } from '../../common/permissions.decorator';
import { ExternalChannelsService } from './external-channels.service';
import { XtreamServersService } from './xtream-servers.service';
import { pinnedProviderRequest, ProviderTransportError, ProviderDiagnostics } from '../../common/pinned-provider-request';
import { parseHls } from './external-policy';
import { expandTemplate, mediaReference, parseDash } from './external-manifests';

type Scope = { userId: string; tenantId: string; channelId: string; country: string; platform: string; expiresAt: number };
type Ticket = Scope & { sessionId: string; sourceId: string; url: string; base: string; depth: number; representations: string[] };
/** Geographical/platform assertions are supplied by a trusted server-side edge,
 * never copied from browser query/Forwarded headers. This is NOT an auth issuer:
 * actual Supabase identity is required independently on EVERY request. */
export function playbackScope(assertion: string | undefined, user: UserRequest, channelId: string): Scope {
  const key = process.env.EXTERNAL_PLAYBACK_CONTEXT_KEY;
  if (!key || key.length < 32 || !assertion || assertion.length > 2000) throw new ForbiddenException('TRUSTED_PLAYBACK_CONTEXT_REQUIRED');
  try {
    const parts=assertion.split('.'); if(parts.length!==2)throw new Error();
    const [payload, signature] = parts;
    const expected = createHmac('sha256', key).update(payload).digest();
    const provided = Buffer.from(signature, 'base64url');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new Error();
    const scope = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Scope;
    if (scope.userId !== user.id || scope.tenantId !== user.tenantId || scope.channelId !== channelId || !/^[A-Z]{2}$/.test(scope.country) || !['web','android','ios','tv'].includes(scope.platform) || !Number.isSafeInteger(scope.expiresAt) || scope.expiresAt <= Date.now() || scope.expiresAt > Date.now() + 300000) throw new Error();
    return scope;
  } catch { throw new ForbiddenException('INVALID_PLAYBACK_CONTEXT'); }
}
@Controller('external-playback')
@UseGuards(SupabaseAuthGuard)
@UseInterceptors(ExternalPlaybackMetricsInterceptor)
export class ExternalPlaybackController {
  constructor(private readonly channels: ExternalChannelsService, private readonly vault: XtreamServersService, private readonly sessions: ExternalPlaybackSessionService) {}
  @Post(':id/session')
  async createSession(@CurrentUser() user: UserRequest, @Param('id') id:string, @Req() req:Request) {
    const token=req.headers.authorization?.slice(7)||'';const geo=verifyGeo(req.headers['x-external-geo'],id,token);
    await this.channels.selected(user.tenantId,id,geo.country,geo.platform);
    const lease=await this.sessions.create(user,id,req);return {id:lease.id,expiresAt:lease.expiresAt};
  }
  @Put(':id/session')
  async renewSession(@CurrentUser() user:UserRequest,@Param('id') id:string,@Req() req:Request){
    const lease=await this.sessions.require(user,id,req.headers['x-playback-session'],req);
    await this.channels.selected(user.tenantId,id,lease.country,lease.platform);
    return this.sessions.renew(user,id,lease.id,req);
  }
  @Delete(':id/session')
  async revokeSession(@CurrentUser() user:UserRequest,@Req() req:Request){await this.sessions.revoke(user,req.headers['x-playback-session']);return {revoked:true};}
  @Post(':id/metrics')
  async metrics(@CurrentUser() user:UserRequest,@Param('id') id:string,@Req() req:Request,@Body() body:{event?:unknown;value?:unknown}){
    await this.sessions.require(user,id,req.headers['x-playback-session'],req);
    if(!['startup','buffering','failure'].includes(String(body?.event))||typeof body?.value!=='number'||!Number.isFinite(body.value)||body.value<0||body.value>14400000)throw new ForbiddenException('INVALID_PLAYBACK_METRIC');
    playbackMetric(String(body.event),body.value);return {accepted:true};
  }
  @Get(':id/manifest') @Header('Cache-Control','no-store')
  async start(@CurrentUser() user: UserRequest, @Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const lease=await this.sessions.require(user,id,req.headers['x-playback-session'],req);
    const scope:Scope={userId:user.id,tenantId:user.tenantId,channelId:id,country:lease.country,platform:lease.platform,expiresAt:Math.min(Date.now()+300000,lease.absoluteExpiresAt.getTime())};
    const source = await this.channels.selected(user.tenantId, id, scope.country, scope.platform);
    const url = this.vault.decryptSecret(source.server.endpointEncrypted);
    return this.send(user, { ...scope, sessionId:lease.id, sourceId: source.id, url, base: url, depth: 0, representations: [] }, res,req);
  }
  @Get(':id/resource') @Header('Cache-Control','no-store')
  async resource(@CurrentUser() user: UserRequest, @Param('id') id: string, @Query('ticket') token: string, @Query('representation') representation: string | undefined, @Query('number') number: string | undefined, @Query('time') time: string | undefined, @Req() req:Request, @Res() res: Response) {
    let ticket: Ticket;
    try {
      if (typeof token !== 'string' || token.length > 16000) throw new Error();
      ticket = JSON.parse(this.vault.decryptSecret(token));
      if (ticket.channelId !== id || ticket.userId !== user.id || ticket.tenantId !== user.tenantId || ticket.expiresAt <= Date.now() || ticket.expiresAt > Date.now()+300000 || !Number.isInteger(ticket.depth) || ticket.depth > 3) throw new Error();
      if (ticket.url.includes('$')) {
        const rep = representation || ticket.representations[0];
        if (!ticket.representations.includes(rep)) throw new Error();
        ticket.url = expandTemplate(ticket.url, rep, number === undefined ? 1 : Number(number), time === undefined ? 0 : Number(time));
      }
    } catch { throw new ForbiddenException('INVALID_MEDIA_RESOURCE'); }
    const lease=await this.sessions.require(user,id,req.headers['x-playback-session'],req);
    if(lease.id!==ticket.sessionId)throw new ForbiddenException('MEDIA_SESSION_MISMATCH');
    return this.send(user, ticket, res,req);
  }
  private async send(user: UserRequest, ticket: Ticket, res: Response,req:Request) {
    const selected = await this.channels.selected(user.tenantId, ticket.channelId, ticket.country, ticket.platform);
    if (selected.id !== ticket.sourceId) throw new ForbiddenException('SOURCE_CHANGED_REFRESH_MANIFEST');
    const base = new URL(ticket.base), url = mediaReference(ticket.url, base);
    let response: globalThis.Response | undefined;
    const policy=await this.channels.channel(user.tenantId,ticket.channelId);
    const maxAttempts=Math.min(3,policy.failureThreshold);
    let attempts=0;
    for(;attempts<maxAttempts;attempts++){
      if(ticket.expiresAt<=Date.now())throw new ForbiddenException('MEDIA_CONTEXT_EXPIRED');
      if(attempts>0){const retrySource=await this.channels.selected(user.tenantId,ticket.channelId,ticket.country,ticket.platform);if(retrySource.id!==ticket.sourceId)throw new ForbiddenException('SOURCE_CHANGED_REFRESH_MANIFEST');}
      const diagnostics:ProviderDiagnostics={dns:'not_verified',tcp:'not_verified',tls:'not_verified'};
      try {
        response = await pinnedProviderRequest(url, { method:'GET', signal:AbortSignal.timeout(8000) }, undefined, 8*1024*1024, process.env.EXTERNAL_ALLOW_CLEARTEXT_MEDIA === 'true',diagnostics);
        if(response.status===206)throw new ForbiddenException('UNEXPECTED_PARTIAL_UPSTREAM');
        if(response.ok || ![500,502,503,504].includes(response.status))break;
      } catch(error) { response=undefined; if((error instanceof ProviderTransportError && error.code==='INVALID_URL') || diagnostics.reason==='TLS_CERTIFICATE_INVALID')break; }
      if(attempts+1<maxAttempts)await new Promise(resolve=>setTimeout(resolve,250*(attempts+1)));
    }
    if (!response?.ok) {
      await this.channels.playbackFailure(user.tenantId,ticket.channelId,ticket.sourceId,Math.min(maxAttempts,attempts+1));
      return res.status(502).json({ error:'UPSTREAM_MEDIA_UNAVAILABLE_REFRESH_MANIFEST' });
    }
    const mime = response.headers.get('content-type')?.split(';')[0].toLowerCase();
    const reference = (value: string, representations = ticket.representations) => {
      // Tokens are encrypted/authenticated resource addresses, not identity tokens.
      // They are bound to the actual user, channel, source and short scope expiry.
      if (ticket.depth >= 3) throw new ForbiddenException('MANIFEST_DEPTH_EXCEEDED');
      const resolved = value.includes('$') ? new URL(value, url).href : mediaReference(value, url).href;
      const token = this.vault.encryptSecret(JSON.stringify({ ...ticket, url:resolved, base:ticket.base, depth:ticket.depth+1, representations }));
      const suffix = (value.includes('$RepresentationID$') ? '&representation=$RepresentationID$' : '') + (/\$Number(?:%0[1-9]d)?\$/.test(value) ? '&number=$Number$' : '') + (value.includes('$Time$') ? '&time=$Time$' : '');
      return `/external-playback/${ticket.channelId}/resource?ticket=${encodeURIComponent(token)}${suffix}`;
    };
    let body: string | Buffer;
    if (['application/vnd.apple.mpegurl','application/x-mpegurl','audio/mpegurl','audio/x-mpegurl'].includes(mime || '')) {
      const text = await response.text(), parsed = parseHls(text,url);
      if(/URI=(?!")/.test(text))throw new ForbiddenException('UNSUPPORTED_MANIFEST_URI');
      if (parsed.result !== 'reachable_and_hls_valid') throw new ForbiddenException('UNSUPPORTED_OR_PROTECTED_MANIFEST');
      body = text.split(/\r?\n/).map(line => !line.trim() ? line : line.startsWith('#') ? line.replace(/URI="([^"]+)"/g, (_match, value) => `URI="${reference(value)}"`) : reference(line.trim())).join('\n');
    } else if (mime === 'application/dash+xml') {
      const text = await response.text(), parsed = parseDash(text,url);
      if (parsed.result !== 'reachable_and_dash_valid') throw new ForbiddenException('PROTECTED_MANIFEST');
      body = text.replace(/\b(media|initialization|sourceURL)=(['"])(.*?)\2/g, (_match, attr, quote, value) => `${attr}=${quote}${reference(value, parsed.representationIds).replaceAll('&','&amp;')}${quote}`);
    } else {
      if (!['video/mp2t','video/mp4','audio/mp4','audio/aac','text/vtt'].includes(mime || '')) throw new ForbiddenException('UNSUPPORTED_MEDIA_MIME');
      body = Buffer.from(await response.arrayBuffer());
    }
    if(typeof body==='string'){
      const secrets=[...base.searchParams.values(),...url.searchParams.values()].filter(value=>value.length>=4);
      if(body.includes(base.origin)||secrets.some(secret=>body.includes(secret)||body.includes(encodeURIComponent(secret))))throw new ForbiddenException('PROVIDER_SECRET_REFLECTION_DENIED');
    }
    // A rights revocation/source switch while bytes were fetching must fail closed.
    if(ticket.expiresAt<=Date.now())throw new ForbiddenException('MEDIA_CONTEXT_EXPIRED');
    const rechecked = await this.channels.selected(user.tenantId, ticket.channelId, ticket.country, ticket.platform);
    if (rechecked.id !== selected.id) throw new ForbiddenException('SOURCE_CHANGED_REFRESH_MANIFEST');
    await this.sessions.require(user,ticket.channelId,ticket.sessionId,req);
    res.setHeader('Cache-Control','private, no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.type(mime!);
    if(typeof body==='string' && req.headers.range)return res.status(416).end();
    if(Buffer.isBuffer(body)){
      res.setHeader('Accept-Ranges','bytes');
      try{const range=mediaRange(req.headers.range,body.length);if(range){res.setHeader('Content-Range',`bytes ${range.start}-${range.end}/${body.length}`);res.setHeader('Content-Length',String(range.end-range.start+1));return res.status(206).send(body.subarray(range.start,range.end+1));}}
      catch{res.setHeader('Content-Range',`bytes */${body.length}`);return res.status(416).end();}
    }
    return res.send(body);
  }
}
