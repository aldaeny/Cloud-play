import { Controller, ForbiddenException, Get, Header, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
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
type Ticket = Scope & { sourceId: string; url: string; base: string; depth: number; representations: string[] };
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
export class ExternalPlaybackController {
  constructor(private readonly channels: ExternalChannelsService, private readonly vault: XtreamServersService) {}
  @Get(':id/manifest') @Header('Cache-Control','no-store')
  async start(@CurrentUser() user: UserRequest, @Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const scope = playbackScope(typeof req.headers['x-external-context'] === 'string' ? req.headers['x-external-context'] : undefined, user, id);
    const source = await this.channels.selected(user.tenantId, id, scope.country, scope.platform);
    const url = this.vault.decryptSecret(source.server.endpointEncrypted);
    return this.send(user, { ...scope, sourceId: source.id, url, base: url, depth: 0, representations: [] }, res);
  }
  @Get(':id/resource') @Header('Cache-Control','no-store')
  async resource(@CurrentUser() user: UserRequest, @Param('id') id: string, @Query('ticket') token: string, @Query('representation') representation: string | undefined, @Query('number') number: string | undefined, @Query('time') time: string | undefined, @Res() res: Response) {
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
    return this.send(user, ticket, res);
  }
  private async send(user: UserRequest, ticket: Ticket, res: Response) {
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
    // A rights revocation/source switch while bytes were fetching must fail closed.
    if(ticket.expiresAt<=Date.now())throw new ForbiddenException('MEDIA_CONTEXT_EXPIRED');
    const rechecked = await this.channels.selected(user.tenantId, ticket.channelId, ticket.country, ticket.platform);
    if (rechecked.id !== selected.id) throw new ForbiddenException('SOURCE_CHANGED_REFRESH_MANIFEST');
    res.setHeader('Cache-Control','private, no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.type(mime!); return res.send(body);
  }
}
