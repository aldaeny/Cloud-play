import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, ExternalChannel } from '@prisma/client';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../prisma.service';
import { mayRedistribute } from './external-policy';
export function externalId(value: string) { if (!isUUID(value)) throw new BadRequestException('INVALID_ID'); return value; }
export function externalBody(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('INVALID_INPUT'); return value as Record<string, unknown>; }
function name(value: unknown, max = 120) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new BadRequestException('INVALID_NAME'); return value.trim(); }
function integer(value: unknown, min: number, max: number) { if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new BadRequestException('INVALID_POLICY'); return Number(value); }
const sourceInclude = { server: { include: { license: true, checks: { take: 1, orderBy: { startedAt: 'desc' as const } } } } };
type Source = Prisma.ChannelSourceGetPayload<{ include: typeof sourceInclude }>;
export function healthySource(source: Source, channel: ExternalChannel, now: Date) {
  const s = source.server, last = s.checks[0];
  return !!last && ['reachable_and_hls_valid', 'reachable_and_dash_valid'].includes(last.result) &&
    !!s.lastCheckedAt && last.startedAt >= s.lastCheckedAt && now.getTime() - last.finishedAt.getTime() <= channel.freshnessSeconds * 1000 &&
    (last.details as Record<string, unknown>)?.segmentStatus !== 'failed_or_invalid_mime';
}
export function sourceRights(source: Source, channel: ExternalChannel, now: Date) {
  const s = source.server;
  return source.enabled && s.enabled && s.status === 'production_enabled' && !s.deletedAt &&
    mayRedistribute(s.license, s.providerName, channel.platform, channel.country, now);
}
@Injectable()
export class ExternalChannelsService {
  constructor(private readonly prisma: PrismaService) {}
  private audit(tx: Prisma.TransactionClient, tenantId: string, actorId: string, entityId: string, action: string) {
    return tx.serverAuditLog.create({ data: { tenantId, actorId, entityId, action } });
  }
  async groups(tenantId: string) { return this.prisma.providerGroup.findMany({ where: { tenantId }, take: 100, orderBy: { name: 'asc' } }); }
  async createGroup(tenantId: string, actorId: string, input: unknown) {
    const body = externalBody(input);
    return this.prisma.$transaction(async tx => { const row = await tx.providerGroup.create({ data: { tenantId, name: name(body.name) } }); await this.audit(tx, tenantId, actorId, row.id, 'PROVIDER_GROUP_CREATED'); return row; });
  }
  async channel(tenantId: string, channelId: string) {
    const row = await this.prisma.externalChannel.findFirst({ where: { tenantId, id: externalId(channelId) } });
    if (!row) throw new NotFoundException('CHANNEL_NOT_FOUND'); return row;
  }
  async channels(tenantId: string) {
    const rows = await this.prisma.externalChannel.findMany({ where: { tenantId }, include: { sources: { orderBy: { priority: 'asc' }, select: { id: true, serverId: true, priority: true, role: true, enabled: true, consecutiveFailures: true, healthySince: true, lastObservedAt: true, server: { select: { name: true, providerName: true, status: true, license: { select: { status: true, expiryDate: true } }, checks: { take:1, orderBy:{startedAt:'desc'}, select:{result:true,finishedAt:true,details:true} } } } } } }, take: 100, orderBy: { name: 'asc' } });
    return rows;
  }
  async createChannel(tenantId: string, actorId: string, input: unknown) {
    const body = externalBody(input), groupId = externalId(String(body.groupId));
    if (!await this.prisma.providerGroup.findFirst({ where: { id: groupId, tenantId } })) throw new NotFoundException('GROUP_NOT_FOUND');
    const country = name(body.country, 2).toUpperCase(), platform = name(body.platform, 16);
    if (!/^[A-Z]{2}$/.test(country) || !['web', 'android', 'ios', 'tv'].includes(platform)) throw new BadRequestException('INVALID_SCOPE');
    return this.prisma.$transaction(async tx => { const row = await tx.externalChannel.create({ data: { tenantId, groupId, name: name(body.name), country, platform } }); await this.audit(tx, tenantId, actorId, row.id, 'CHANNEL_CREATED_DISABLED'); return row; });
  }
  async addSource(tenantId: string, actorId: string, channelId: string, input: unknown) {
    const body = externalBody(input), serverId = externalId(String(body.serverId));
    await this.channel(tenantId, channelId);
    if (!await this.prisma.externalServer.findFirst({ where: { id: serverId, tenantId, deletedAt: null } })) throw new NotFoundException('SERVER_NOT_FOUND');
    const priority = integer(body.priority, 1, 1000), role = priority === 1 ? 'primary' : 'secondary';
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${channelId}, 0))`;
      if (await tx.channelSource.count({ where: { tenantId, channelId } }) >= 100) throw new BadRequestException('CHANNEL_SOURCE_LIMIT');
      const row = await tx.channelSource.create({ data: { tenantId, channelId, serverId, priority, role } });
      await this.audit(tx, tenantId, actorId, row.id, 'CHANNEL_SOURCE_ADDED_DISABLED'); return row;
    });
  }
  async reorder(tenantId: string, actorId: string, channelId: string, input: unknown) {
    const body = externalBody(input); await this.channel(tenantId, channelId);
    if (!Array.isArray(body.sourceIds) || !body.sourceIds.length || body.sourceIds.length > 100 || body.sourceIds.some(id => typeof id !== 'string' || !isUUID(id)) || new Set(body.sourceIds).size !== body.sourceIds.length) throw new BadRequestException('INVALID_SOURCE_ORDER');
    const ids = body.sourceIds as string[];
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${channelId}, 0))`;
      const rows = await tx.channelSource.findMany({ where: { tenantId, channelId } });
      if (rows.length !== ids.length || rows.some(row => !ids.includes(row.id))) throw new BadRequestException('ORDER_MUST_INCLUDE_ALL_SOURCES');
      // Two phases avoid immediate unique-index conflicts, even when reversing the order.
      await tx.channelSource.updateMany({ where: { tenantId, channelId }, data: { role: 'secondary', priority: { increment: 10000 } } });
      for (const [i, id] of ids.entries()) await tx.channelSource.update({ where: { id, tenantId, channelId }, data: { priority: i + 1, role: i === 0 ? 'primary' : 'secondary' } });
      // Exact old/new ranks are durable structured events; no URLs or credentials.
      await tx.externalFailoverEvent.create({ data: { tenantId, channelId, reason: `ORDER:${rows.sort((a,b) => a.priority-b.priority).map(s => s.id).join(',')}=>${ids.join(',')}` } });
      await this.audit(tx, tenantId, actorId, channelId, 'SOURCE_PRIORITY_ORDER_CHANGED'); return { ordered: ids };
    });
  }
  async policy(tenantId: string, actorId: string, channelId: string, input: unknown) {
    const body = externalBody(input); await this.channel(tenantId, channelId);
    if (typeof body.autoFailover !== 'boolean') throw new BadRequestException('INVALID_POLICY');
    const data = { autoFailover: body.autoFailover, failureThreshold: integer(body.failureThreshold, 1, 10), retrySeconds: integer(body.retrySeconds, 5, 3600), holdDownSeconds: integer(body.holdDownSeconds, 0, 86400), stabilitySeconds: integer(body.stabilitySeconds, 0, 86400), freshnessSeconds: integer(body.freshnessSeconds, 60, 3600) };
    return this.prisma.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${channelId}, 0))`; const row = await tx.externalChannel.update({ where: { id: channelId, tenantId }, data }); await this.audit(tx, tenantId, actorId, channelId, 'FAILOVER_POLICY_CHANGED'); return row; });
  }
  /** Explicit human approval, never invoked by a health worker or candidate save. */
  async approveSource(tenantId: string, actorId: string, channelId: string, sourceId: string, input: unknown) {
    const body = externalBody(input);
    if (body.publicationApproved !== true) throw new ForbiddenException('EXPLICIT_PUBLICATION_APPROVAL_REQUIRED');
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${channelId}, 0))`;
      const channel = await tx.externalChannel.findFirst({ where: { id: externalId(channelId), tenantId } });
      const source = await tx.channelSource.findFirst({ where: { id: externalId(sourceId), channelId, tenantId }, include: sourceInclude });
      if (!channel || !source) throw new NotFoundException('SOURCE_NOT_FOUND');
      if(source.server.licenseId)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${source.server.licenseId}, 0))`;
      const freshLicense=source.server.licenseId ? await tx.contentLicense.findFirst({where:{id:source.server.licenseId,tenantId}}) : null;
      if (!mayRedistribute(freshLicense, source.server.providerName, channel.platform, channel.country) || !healthySource(source, channel, new Date()) || (source.server.checks[0].details as Record<string, unknown>)?.segmentStatus !== 'fetched_mime_valid') throw new ForbiddenException('RIGHTS_OR_SEGMENT_READINESS_NOT_VERIFIED');
      const approved=await tx.externalServer.updateMany({ where: { id: source.serverId, tenantId, deletedAt:null, endpointEncrypted:source.server.endpointEncrypted, licenseId:source.server.licenseId, lastCheckedAt:source.server.lastCheckedAt }, data: { enabled: true, status: 'production_enabled' } });
      if(!approved.count)throw new ForbiddenException('SOURCE_CHANGED_RECHECK_REQUIRED');
      // Server updatedAt changes on approval; preserve health version provenance by
      // using lastCheckedAt (reset by edits), rather than treating approval as URL edit.
      await tx.channelSource.update({ where: { id: sourceId, tenantId }, data: { enabled: true } });
      await this.audit(tx, tenantId, actorId, sourceId, 'EXPLICIT_SOURCE_PUBLICATION_APPROVED'); return { approved: true };
    });
  }
  async disableSource(tenantId:string,actorId:string,channelId:string,sourceId:string){
    await this.channel(tenantId,channelId);
    await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${channelId}, 0))`;
      const result=await tx.channelSource.updateMany({where:{id:externalId(sourceId),tenantId,channelId},data:{enabled:false}});
      if(!result.count)throw new NotFoundException('SOURCE_NOT_FOUND');
      await this.audit(tx,tenantId,actorId,sourceId,'CHANNEL_SOURCE_DISABLED');
    });
    return this.evaluate(tenantId,channelId,true);
  }
  async activate(tenantId: string, actorId: string, channelId: string, input: unknown) {
    const body = externalBody(input); await this.channel(tenantId, channelId);
    if (typeof body.enabled !== 'boolean' || (body.enabled && body.publicationApproved !== true)) throw new ForbiddenException('EXPLICIT_CHANNEL_APPROVAL_REQUIRED');
    await this.prisma.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${channelId}, 0))`; await tx.externalChannel.update({ where: { id: channelId, tenantId }, data: { enabled: body.enabled as boolean, ...(body.enabled ? {} : { activeSourceId: null }) } }); await this.audit(tx, tenantId, actorId, channelId, body.enabled ? 'EXPLICIT_CHANNEL_ENABLED' : 'CHANNEL_DISABLED'); });
    return body.enabled ? this.evaluate(tenantId, channelId, true) : { activeSourceId: null };
  }
  async evaluate(tenantId: string, channelId: string, force = false, now = new Date()) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${channelId}, 0))`;
      const channel = await tx.externalChannel.findFirst({ where: { id: externalId(channelId), tenantId } });
      if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
      const rows = await tx.channelSource.findMany({ where: { tenantId, channelId }, orderBy: { priority: 'asc' }, include: sourceInclude });
      const states: Source[] = [];
      for (const source of rows) {
        const last = source.server.checks[0], healthy = healthySource(source, channel, now);
        if (last && (!source.lastObservedAt || last.startedAt > source.lastObservedAt)) {
          const data = { lastObservedAt: last.startedAt, consecutiveFailures: healthy ? 0 : source.consecutiveFailures + 1, healthySince: healthy ? (source.healthySince && source.lastObservedAt && last.startedAt.getTime()-source.lastObservedAt.getTime()<=channel.freshnessSeconds*1000 ? source.healthySince : last.finishedAt) : null };
          await tx.channelSource.update({ where: { id: source.id }, data }); Object.assign(source, data);
        }
        states.push(source);
      }
      const current = states.find(s => s.id === channel.activeSourceId);
      const eligible = (s: Source) => sourceRights(s, channel, now) && healthySource(s, channel, now);
      const currentRights = current && sourceRights(current, channel, now);
      const holdDown = !!channel.lastSwitchAt && now.getTime() - channel.lastSwitchAt.getTime() < channel.holdDownSeconds * 1000;
      const retryDue = force || !channel.lastEvaluationAt || now.getTime() - channel.lastEvaluationAt.getTime() >= channel.retrySeconds * 1000;
      let chosen = current && eligible(current) ? current : undefined;
      let reason = 'SOURCE_UNAVAILABLE';
      if (!channel.enabled) { chosen = undefined; reason = 'CHANNEL_DISABLED'; }
      else if (!current && !channel.activeSourceId) { chosen = states.find(s => s.role === 'primary' && eligible(s)); reason = 'INITIAL_PRIMARY_SELECTION'; }
      else if (current && !eligible(current)) {
        // Rights denial always stops serving immediately, regardless of hold-down,
        // retry intervals, failure thresholds or whether automatic switching is off.
        chosen = undefined;
        if (channel.autoFailover && retryDue && (!holdDown || !currentRights) && (!currentRights || current.consecutiveFailures >= channel.failureThreshold || !current.server.checks[0] || now.getTime() - current.server.checks[0].finishedAt.getTime() > channel.freshnessSeconds * 1000)) {
          chosen = states.find(s => s.id !== current.id && eligible(s)); reason = currentRights ? 'PRIMARY_OR_ACTIVE_FAILED' : 'ACTIVE_RIGHTS_DENIED';
        } else reason = currentRights ? 'AWAITING_RETRY_OR_FAILURE_THRESHOLD' : 'ACTIVE_RIGHTS_DENIED';
      } else if (current && channel.autoFailover && !holdDown && retryDue) {
        const primary = states.find(s => s.role === 'primary' && eligible(s) && s.healthySince && now.getTime() - s.healthySince.getTime() >= channel.stabilitySeconds * 1000);
        if (primary && primary.id !== current.id) { chosen = primary; reason = 'PRIMARY_STABLE_RETURN'; }
      }
      const nextId = chosen?.id || (channel.enabled ? channel.activeSourceId : null);
      const changed = nextId !== channel.activeSourceId;
      const outageStartedAt = !channel.enabled || chosen ? null : channel.outageStartedAt || now;
      if (changed || (!chosen && !channel.outageStartedAt && !!channel.activeSourceId) || (chosen && !!channel.outageStartedAt)) await tx.externalFailoverEvent.create({ data: { tenantId, channelId, fromSourceId: channel.activeSourceId, toSourceId: chosen?.id || null, reason,
        outageDurationMs: chosen && channel.outageStartedAt ? Math.min(2147483647, Math.max(0, now.getTime() - channel.outageStartedAt.getTime())) : null } });
      await tx.externalChannel.update({ where: { id: channelId, tenantId }, data: { activeSourceId: nextId, outageStartedAt, ...(retryDue ? { lastEvaluationAt: now } : {}), ...(changed && channel.activeSourceId ? { lastSwitchAt: now } : {}) } });
      return { activeSourceId: nextId, reason, changed };
    }, { timeout: 10000 });
  }
  async selected(tenantId: string, channelId: string, country: string, platform: string) {
    const channel = await this.channel(tenantId, channelId);
    if (country !== channel.country || platform !== channel.platform) throw new ForbiddenException('PLAYBACK_SCOPE_DENIED');
    await this.evaluate(tenantId, channelId);
    const row = await this.prisma.externalChannel.findFirst({ where: { id: channelId, tenantId }, include: { activeSource: { include: sourceInclude } } });
    if (!row?.enabled || !row.activeSource || !sourceRights(row.activeSource, row, new Date()) || !healthySource(row.activeSource, row, new Date())) throw new ServiceUnavailableException('NO_RIGHTS_ELIGIBLE_HEALTHY_SOURCE');
    return row.activeSource;
  }
  async playbackFailure(tenantId: string, channelId: string, sourceId: string, attempts: number) {
    const source=await this.prisma.channelSource.findFirst({where:{id:sourceId,tenantId,channelId}});
    if(!source)return;
    const count=Math.max(1,Math.min(3,attempts)),now=new Date();
    await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${channelId}, 0))`;
      const claimed=await tx.externalServer.updateMany({where:{id:source.serverId,tenantId,deletedAt:null,OR:[{lastCheckedAt:null},{lastCheckedAt:{lt:new Date(now.getTime()-1000)}}]},data:{lastCheckedAt:now}});
      if(!claimed.count)return; // Coalesce simultaneous viewer failures, not a write storm.
      await tx.serverHealthCheck.create({data:{tenantId,serverId:source.serverId,startedAt:now,finishedAt:now,result:'unreachable',details:{reason:'TRUSTED_BACKEND_PLAYBACK_FETCH_FAILED',attempts:count,playbackReadiness:'failed'}}});
      await tx.channelSource.update({where:{id:sourceId},data:{consecutiveFailures:{increment:count},healthySince:null,lastObservedAt:now}});
    });
    await this.evaluate(tenantId,channelId,true);
  }
  async history(tenantId: string, channelId: string) { await this.channel(tenantId, channelId); return this.prisma.externalFailoverEvent.findMany({ where: { tenantId, channelId }, take: 100, orderBy: { createdAt: 'desc' } }); }
  async evaluateServer(tenantId: string, serverId: string) {
    const sources = await this.prisma.channelSource.findMany({ where: { tenantId, serverId }, select: { channelId: true }, take: 100 });
    for (const source of sources) await this.evaluate(tenantId, source.channelId);
  }
}
