import { createHash } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Prisma, ExternalServer } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { pinnedProviderRequest } from '../../common/pinned-provider-request';
import { XtreamServersService } from './xtream-servers.service';
import { LICENSE_STATUSES, mayRedistribute, parseHls } from './external-policy';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('INVALID_INPUT');
  return value as Record<string, unknown>;
}
function text(body: Record<string, unknown>, key: string, max = 200): string {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim() || value.length > max || [...value].some(char => char.charCodeAt(0) < 32)) throw new BadRequestException(`INVALID_${key}`);
  return value.trim();
}
function strings(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value) || !value.length || value.length > 100 || value.some(x => typeof x !== 'string' || !/^[a-zA-Z0-9_-]{2,32}$/.test(x))) throw new BadRequestException(`INVALID_${key}`);
  return [...new Set(value as string[])];
}
function date(body: Record<string, unknown>, key: string): Date {
  const value = new Date(text(body, key, 40));
  if (!Number.isFinite(value.getTime())) throw new BadRequestException(`INVALID_${key}`);
  return value;
}
function id(value: string): string { if (!isUUID(value)) throw new BadRequestException('INVALID_ID'); return value; }

@Injectable()
export class ExternalServersService {
  constructor(private readonly prisma: PrismaService, private readonly vault: XtreamServersService) {}
  private audit(tx: Prisma.TransactionClient, tenantId: string, actorId: string, entityId: string, action: string) {
    return tx.serverAuditLog.create({ data: { tenantId, actorId, entityId, action } });
  }
  private safe(row: ExternalServer) {
    // Never serialize the URL (may contain signed credentials), ciphertext or linked username.
    const { endpointEncrypted: _secret, ...safe } = row;
    void _secret; return safe;
  }
  private async server(tenantId: string, serverId: string) {
    const row = await this.prisma.externalServer.findFirst({ where: { id: id(serverId), tenantId, deletedAt: null } });
    if (!row) throw new NotFoundException('SERVER_NOT_FOUND'); return row;
  }
  async list(tenantId: string, cursor?: string) {
    const rows = await this.prisma.externalServer.findMany({ where: { tenantId, deletedAt: null }, take: 50,
      ...(cursor ? { cursor: { id: id(cursor) }, skip: 1 } : {}), orderBy: { id: 'asc' } });
    return { items: rows.map(row => this.safe(row)), nextCursor: rows.length === 50 ? rows[49].id : null };
  }
  async save(tenantId: string, actorId: string, input: unknown, serverId?: string) {
    const body = object(input);
    const existing = serverId ? await this.server(tenantId, serverId) : null;
    const name = text(body, 'name', 80), providerName = text(body, 'providerName', 120);
    const protocol = text(body, 'protocol', 16);
    if (!['hls','m3u','dash','direct','xtream'].includes(protocol)) throw new BadRequestException('UNSUPPORTED_PROTOCOL');
    const endpoint = text(body, 'url', 4096); let url: URL;
    try { url = new URL(endpoint); } catch { throw new BadRequestException('INVALID_URL'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new BadRequestException('HTTPS_REQUIRED');
    const priority = body.priority ?? 100;
    if (!Number.isInteger(priority) || Number(priority) < 1 || Number(priority) > 1000) throw new BadRequestException('INVALID_PRIORITY');
    const xtreamServerId = body.xtreamServerId ? id(text(body, 'xtreamServerId')) : null;
    if (protocol === 'xtream' && !xtreamServerId) throw new BadRequestException('EXISTING_XTREAM_REQUIRED');
    if (xtreamServerId && !await this.prisma.xtreamServer.findFirst({ where: { id: xtreamServerId, tenantId } })) throw new NotFoundException('PROVIDER_NOT_FOUND');
    const data = { name, providerName, protocol, endpointEncrypted: this.vault.encryptSecret(url.href), xtreamServerId,
      country: text(body, 'country', 2).toUpperCase(), category: text(body, 'category', 80), priority: Number(priority),
      notes: typeof body.notes === 'string' && body.notes.length <= 2000 ? body.notes : '',
      // ALL edits demote: changed URLs/provider/scope need fresh operational and rights approval.
      status: 'candidate', enabled: false, licenseId: null, lastCheckedAt: null, lastSuccessfulCheck: null };
    return this.prisma.$transaction(async tx => {
      const row = existing ? await tx.externalServer.update({ where: { tenantId_id: { tenantId, id: existing.id } }, data }) :
        await tx.externalServer.create({ data: { ...data, tenantId } });
      await this.audit(tx, tenantId, actorId, row.id, existing ? 'SERVER_UPDATED_DEMOTED' : 'SERVER_CANDIDATE_CREATED'); return this.safe(row);
    });
  }
  async remove(tenantId: string, actorId: string, serverId: string) {
    const row = await this.server(tenantId, serverId);
    return this.prisma.$transaction(async tx => {
      await tx.externalServer.update({ where: { id: row.id, tenantId }, data: { deletedAt: new Date(), enabled: false, status: 'candidate' } });
      await this.audit(tx, tenantId, actorId, row.id, 'SERVER_SOFT_DELETED'); return { deleted: true };
    });
  }
  async licenses(tenantId: string) { return this.prisma.contentLicense.findMany({ where: { tenantId }, take: 100, orderBy: { createdAt: 'desc' } }); }
  async createLicense(tenantId: string, actorId: string, input: unknown) {
    const body = object(input), startDate = date(body, 'startDate'), expiryDate = date(body, 'expiryDate');
    if (expiryDate <= startDate) throw new BadRequestException('INVALID_LICENSE_PERIOD');
    const data = { tenantId, provider: text(body, 'provider'), contentOwner: text(body, 'contentOwner'),
      authorizedContact: text(body, 'authorizedContact'), authorizationType: text(body, 'authorizationType'),
      allowedPlatforms: strings(body, 'allowedPlatforms'), allowedCountries: strings(body, 'allowedCountries'),
      commercialUse: body.commercialUse === true, redistributionPermission: body.redistributionPermission === true,
      territoryRestrictions: text(body, 'territoryRestrictions', 2000), startDate, expiryDate, status: 'licensing_unverified' };
    return this.prisma.$transaction(async tx => {
      const row = await tx.contentLicense.create({ data });
      await this.audit(tx, tenantId, actorId, row.id, 'LICENSE_CREATED_UNVERIFIED'); return row;
    });
  }
  async reviewLicense(tenantId: string, actorId: string, licenseId: string, input: unknown) {
    const body = object(input), status = text(body, 'status'), notes = text(body, 'notes', 2000);
    if (!(LICENSE_STATUSES as readonly string[]).includes(status)) throw new BadRequestException('INVALID_LICENSE_STATUS');
    return this.prisma.$transaction(async tx => {
      const row = await tx.contentLicense.findFirst({ where: { tenantId, id: id(licenseId) } });
      if (!row) throw new NotFoundException('LICENSE_NOT_FOUND');
      // Serialize review vs assignment/promotion, and always demote already attached sources.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${licenseId}, 0))`;
      if (status === 'verified_authorized' && (!row.redistributionPermission || !row.commercialUse || row.expiryDate <= new Date() || body.scopeReviewed !== true || body.issuerVerified !== true)) throw new BadRequestException('RIGHTS_SCOPE_NOT_VERIFIED');
      const result = await tx.contentLicense.update({ where: { id: row.id, tenantId }, data: { status, verificationNotes: notes, reviewedBy: actorId, reviewDate: new Date() } });
      await tx.licenseReview.create({ data: { tenantId, licenseId, reviewedBy: actorId, status, notes } });
      await tx.externalServer.updateMany({ where: { tenantId, licenseId }, data: { enabled: false, status: 'candidate' } });
      await this.audit(tx, tenantId, actorId, row.id, `LICENSE_REVIEW_${status}`); return result;
    });
  }
  async assignLicense(tenantId: string, actorId: string, serverId: string, licenseId: string) {
    await this.server(tenantId, serverId);
    return this.prisma.$transaction(async tx => {
      const license = await tx.contentLicense.findFirst({ where: { tenantId, id: id(licenseId) } });
      if (!license) throw new NotFoundException('LICENSE_NOT_FOUND');
      await tx.externalServer.update({ where: { id: serverId, tenantId }, data: { licenseId, enabled: false, status: 'candidate' } });
      await this.audit(tx, tenantId, actorId, serverId, 'LICENSE_ATTACHED_NOT_PUBLISHED'); return { attached: true, status: 'candidate' };
    });
  }
  async uploadDocument(tenantId: string, actorId: string, licenseId: string, input: unknown) {
    const body = object(input), mimeType = text(body, 'mimeType', 80), content = text(body, 'contentBase64', 65536);
    if (!['application/pdf', 'image/png', 'image/jpeg', 'message/rfc822', 'text/plain'].includes(mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) throw new BadRequestException('INVALID_DOCUMENT');
    const bytes = Buffer.from(content, 'base64');
    if (!bytes.length || bytes.length > 49152 || bytes.toString('base64') !== content) throw new BadRequestException('DOCUMENT_TOO_LARGE_OR_INVALID');
    if ((mimeType === 'application/pdf' && bytes.subarray(0, 5).toString() !== '%PDF-') ||
      (mimeType === 'image/png' && bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') ||
      (mimeType === 'image/jpeg' && bytes.subarray(0, 3).toString('hex') !== 'ffd8ff')) throw new BadRequestException('DOCUMENT_TYPE_MISMATCH');
    return this.prisma.$transaction(async tx => {
      const license = await tx.contentLicense.findFirst({ where: { tenantId, id: id(licenseId) } });
      if (!license) throw new NotFoundException('LICENSE_NOT_FOUND');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${licenseId}, 0))`;
      if (await tx.licenseDocument.count({ where: { tenantId, licenseId } }) >= 20) throw new BadRequestException('DOCUMENT_LIMIT');
      const row = await tx.licenseDocument.create({ data: { tenantId, licenseId, uploadedBy: actorId, mimeType, byteLength: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'), contentEncrypted: this.vault.encryptSecret(content) } });
      await this.audit(tx, tenantId, actorId, row.id, 'RIGHTS_DOCUMENT_ATTACHED_NOT_APPROVED');
      return { id: row.id, mimeType, byteLength: row.byteLength, sha256: row.sha256, createdAt: row.createdAt };
    });
  }
  async documents(tenantId: string, licenseId: string) {
    return this.prisma.licenseDocument.findMany({ where: { tenantId, licenseId: id(licenseId) }, select: { id: true, licenseId: true, mimeType: true, byteLength: true, sha256: true, createdAt: true }, take: 20 });
  }
  async readDocument(tenantId: string, actorId: string, documentId: string) {
    const row = await this.prisma.licenseDocument.findFirst({ where: { tenantId, id: id(documentId) } });
    if (!row) throw new NotFoundException('DOCUMENT_NOT_FOUND');
    const contentBase64 = this.vault.decryptSecret(row.contentEncrypted);
    await this.prisma.$transaction(tx => this.audit(tx, tenantId, actorId, documentId, 'RIGHTS_DOCUMENT_READ'));
    return { id: row.id, mimeType: row.mimeType, contentBase64 };
  }
  async eligibility(tenantId: string, serverId: string, platform: string, country: string) {
    const row = await this.server(tenantId, serverId);
    const license = row.licenseId ? await this.prisma.contentLicense.findFirst({ where: { id: row.licenseId, tenantId } }) : null;
    const rights = mayRedistribute(license, row.providerName, platform, country);
    // Advisory only. No publication/failover mutation endpoint exists until full scope checks are implemented.
    return { rightsEligible: rights, operationallyEligible: !!row.lastSuccessfulCheck && !!row.lastCheckedAt && row.lastSuccessfulCheck >= row.lastCheckedAt && Date.now() - row.lastSuccessfulCheck.getTime() < 900000,
      productionEnabled: false, licensingStatus: license && license.expiryDate <= new Date() ? 'expired' : license?.status || 'licensing_unverified' };
  }
  async history(tenantId: string, serverId: string) {
    await this.server(tenantId, serverId);
    return this.prisma.serverHealthCheck.findMany({ where: { tenantId, serverId }, take: 100, orderBy: { startedAt: 'desc' } });
  }
  async audits(tenantId: string) { return this.prisma.serverAuditLog.findMany({ where: { tenantId }, take: 100, orderBy: { createdAt: 'desc' } }); }
  async check(tenantId: string, actorId: string, serverId: string, input: unknown) {
    const body = object(input), row = await this.server(tenantId, serverId);
    if (body.technicalAccessConfirmed !== true) throw new ForbiddenException('TECHNICAL_ACCESS_CONFIRMATION_REQUIRED');
    if (row.lastCheckedAt && Date.now() - row.lastCheckedAt.getTime() < 60000) throw new BadRequestException('CHECK_RATE_LIMITED');
    const startedAt = new Date();
    const endpoint = new URL(this.vault.decryptSecret(row.endpointEncrypted));
    let result = 'unreachable';
    const license = row.licenseId ? await this.prisma.contentLicense.findFirst({ where: { id: row.licenseId, tenantId } }) : null;
    const details: Record<string, string | number | boolean | null> = { dns: 'not_verified', tcp: 'not_verified', tls: 'not_verified', httpStatus: null,
      hlsStatus: 'not_tested', segmentStatus: 'not_requested', reason: 'ORIGIN_UNREACHABLE', licensingStatus: license && license.expiryDate <= startedAt ? 'expired' : license?.status || 'licensing_unverified' };
    // Durable per-server lease via compare-and-swap prevents duplicate probes across API replicas.
    const lease = await this.prisma.externalServer.updateMany({ where: { id: row.id, tenantId, deletedAt: null, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 60000) } }] }, data: { lastCheckedAt: startedAt } });
    if (!lease.count) throw new BadRequestException('CHECK_ALREADY_RUNNING');
    try {
      if (row.protocol === 'xtream') { result = 'not_checked'; details.reason = 'USE_EXISTING_XTREAM_HEALTH_ENDPOINT'; }
      else {
        const response = await pinnedProviderRequest(endpoint, { method: 'GET', signal: AbortSignal.timeout(8000) }, undefined, 1024 * 1024);
        details.dns = details.tcp = details.tls = 'passed'; details.httpStatus = response.status;
        details.contentType = response.headers.get('content-type')?.split(';')[0] || 'unknown';
        details.reason = response.status >= 300 && response.status < 400 ? 'REDIRECT_REFUSED' : `HTTP_${response.status}`;
        if (response.status === 401 || response.status === 403) result = 'auth_required';
        else if (response.ok && ['hls', 'm3u'].includes(row.protocol)) {
          const mimeValid = ['application/vnd.apple.mpegurl', 'application/x-mpegurl', 'audio/mpegurl', 'audio/x-mpegurl'].includes(String(details.contentType).toLowerCase());
          const parsed = mimeValid ? parseHls(await response.text(), endpoint) : { result: 'malformed_playlist', reference: undefined, kind: undefined };
          if (!mimeValid) details.reason = 'HLS_MIME_INVALID'; result = parsed.result; details.hlsStatus = parsed.result; if (mimeValid) details.reason = parsed.result;
          if (parsed.reference && body.segmentAccessConfirmed === true && parsed.kind === 'segment') {
            const segment = await pinnedProviderRequest(parsed.reference, { method: 'GET', signal: AbortSignal.timeout(8000) }, undefined, 2 * 1024 * 1024);
            const mime = segment.headers.get('content-type')?.split(';')[0] || '';
            details.segmentStatus = segment.ok && ['video/mp2t', 'video/mp4', 'audio/aac', 'audio/mp4'].includes(mime) ? 'fetched_mime_valid' : 'failed_or_invalid_mime';
          } else if (parsed.kind === 'variant') details.segmentStatus = 'variant_not_fetched';
        } else if (response.ok) { result = 'reachable_not_playback_verified'; details.reason = 'REACHABLE_NOT_PLAYBACK_VERIFIED'; }
      }
    } catch { details.reason = 'TRANSPORT_FAILED_OR_POLICY_DENIED'; }
    details.responseTimeMs = Date.now() - startedAt.getTime();
    const finishedAt = new Date();
    return this.prisma.$transaction(async tx => {
      const check = await tx.serverHealthCheck.create({ data: { tenantId, serverId, startedAt, finishedAt, result, details } });
      if (result === 'reachable_and_hls_valid' && details.segmentStatus !== 'failed_or_invalid_mime') await tx.externalServer.updateMany({ where: { tenantId, id: serverId, lastCheckedAt: startedAt, endpointEncrypted: row.endpointEncrypted }, data: { lastSuccessfulCheck: finishedAt } });
      await this.audit(tx, tenantId, actorId, serverId, 'TECHNICAL_CHECK_COMPLETED'); return check;
    });
  }
}
