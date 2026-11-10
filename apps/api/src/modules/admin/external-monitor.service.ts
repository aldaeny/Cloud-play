import { ExternalReportsService } from './external-reports.service';
import { ExternalChannelsService } from './external-channels.service';
import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../prisma.service';
import { ExternalServersService } from './external-servers.service';
const intervals: Record<string, number> = { quarter_hour: 900, hourly: 3600, daily: 86400, weekly: 604800 };

@Injectable()
export class ExternalMonitorService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopped = false;
  private readonly logger = new Logger(ExternalMonitorService.name);
  constructor(private readonly prisma: PrismaService, private readonly servers: ExternalServersService, private readonly channels?: ExternalChannelsService, private readonly reports?: ExternalReportsService) {}
  onModuleInit() {
    if (process.env.EXTERNAL_MONITOR_SCHEDULER_ENABLED !== 'true') return;
    // No autonomous external requests unless an operator explicitly enables the worker.
    this.timer = setInterval(() => { if (!this.running) this.running = this.tick().catch(() => { this.logger.error('MONITOR_ENVIRONMENT_OR_DATABASE_FAILED'); }).finally(() => { this.running = undefined; }); }, 60000);
  }
  async onModuleDestroy() { this.stopped = true; clearInterval(this.timer); await this.running; }
  async configure(tenantId: string, actorId: string, serverId: string, input: unknown) {
    if (!isUUID(serverId) || !input || typeof input !== 'object') throw new BadRequestException('INVALID_SCHEDULE');
    const body = input as Record<string, unknown>;
    const seconds = typeof body.frequency === 'string' ? intervals[body.frequency] : undefined;
    if (!seconds || typeof body.enabled !== 'boolean' || (body.enabled && body.technicalAccessConfirmed !== true)) throw new BadRequestException('INVALID_SCHEDULE_OR_CONFIRMATION');
    // Scope check before any mutation. Missing/foreign/deleted source returns404.
    await this.servers.history(tenantId, serverId);
    return this.prisma.$transaction(async tx => {
      const row = await tx.serverSchedule.upsert({ where: { serverId }, create: { serverId, tenantId, actorId, intervalSeconds: seconds, enabled: body.enabled as boolean, nextRunAt: new Date() },
        update: { leaseUntil: null, actorId, intervalSeconds: seconds, enabled: body.enabled as boolean, nextRunAt: new Date() } });
      await tx.serverAuditLog.create({ data: { tenantId, actorId, entityId: serverId, action: body.enabled ? 'TECHNICAL_SCHEDULE_ENABLED' : 'TECHNICAL_SCHEDULE_DISABLED' } });
      return { ...row, workerEnabled: process.env.EXTERNAL_MONITOR_SCHEDULER_ENABLED === 'true' };
    });
  }
  /** Durable CAS lease, bounded sequential batch; expired leases recover after crash.
   * No write/publish/failover is ever performed by a health job. */
  async tick() {
    const now = new Date();
    await this.reports?.tick(now);
    const due = await this.prisma.serverSchedule.findMany({ where: { enabled: true, nextRunAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }], server: { deletedAt: null } }, take: 10, orderBy: { nextRunAt: 'asc' } });
    for (const row of due) {
      if (this.stopped) break;
      const leaseUntil = new Date(Date.now() + 300000);
      const claim = await this.prisma.serverSchedule.updateMany({ where: { serverId: row.serverId, enabled: true, updatedAt: row.updatedAt, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { leaseUntil } });
      if (!claim.count) continue;
      let lastError: string | null = null;
      try { await this.servers.check(row.tenantId, row.actorId, row.serverId, { technicalAccessConfirmed: true }); await this.channels?.evaluateServer(row.tenantId, row.serverId); }
      catch { lastError = 'MONITOR_JOB_FAILED_OR_RATE_LIMITED'; }
      // Fence completion against a newer claim/configuration. Failed checks are
      // recorded as failures, never successful playback or global provider outage.
      await this.prisma.serverSchedule.updateMany({ where: { serverId: row.serverId, leaseUntil }, data: { leaseUntil: null, lastError, nextRunAt: new Date(Date.now() + row.intervalSeconds * 1000) } });
    }
  }
  async report(tenantId: string, period: string) {
    if (!['daily', 'weekly'].includes(period)) throw new BadRequestException('INVALID_REPORT_PERIOD');
    const since = new Date(Date.now() - (period === 'daily' ? 1 : 7) * 86400000);
    const checks = await this.prisma.serverHealthCheck.groupBy({ by: ['result'], where: { tenantId, startedAt: { gte: since } }, _count: true });
    const licenses = await this.prisma.contentLicense.groupBy({ by: ['status'], where: { tenantId }, _count: true });
    return { period, timezone: 'Asia/Baghdad', since, generatedAt: new Date(), checks, licenses,
      expiredLicenses: await this.prisma.contentLicense.count({ where: { tenantId, expiryDate: { lte: new Date() } } }),
      deliveryStatus: 'on_demand_only', environmentStatus: 'not_independently_verified', warning: 'No successful check means unverified, not proof of provider downtime. Reports do not grant rights.' };
  }
}
