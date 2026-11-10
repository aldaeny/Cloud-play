import { BadRequestException, ConflictException, Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { setTimeout as pause } from 'node:timers/promises';
import { PrismaService } from '../../prisma.service';
import { XtreamServersService } from './xtream-servers.service';
import { XtreamProviderAdapter } from './xtream-provider.adapter';
import { XtreamCatalogSyncService } from './xtream-catalog-sync.service';

type Schedule = { tenantId: string; serverId: string; intervalSeconds: number; authorizationConfirmed: true };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseSyncSchedule(raw: string): Schedule[] {
  const input: unknown = JSON.parse(raw);
  if (!Array.isArray(input) || input.length > 20) throw new Error('INVALID_SYNC_SCHEDULE');
  const seen = new Set<string>();
  for (const entry of input) {
    if (!entry || typeof entry !== 'object' || !UUID.test(entry.tenantId) || !UUID.test(entry.serverId) ||
      !Number.isInteger(entry.intervalSeconds) || entry.intervalSeconds < 300 || entry.intervalSeconds > 86400 ||
      entry.authorizationConfirmed !== true || seen.has(entry.serverId)) throw new Error('INVALID_SYNC_SCHEDULE');
    seen.add(entry.serverId);
  }
  return input;
}

/** Bounded opt-in scheduler. Nothing contacts a provider merely because it is
 * configured: manual calls require confirmation; automatic pulls require an
 * explicit operator schedule. Transactions hold only a bounded advisory lock,
 * never write catalog until a complete validated retrieval has succeeded. */
@Injectable()
export class XtreamSyncRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private schedules: Schedule[] = [];
  private active = new Map<string, AbortController>();
  private ticking = false;
  private stopped = false;
  constructor(private readonly prisma: PrismaService, private readonly servers: XtreamServersService,
    private readonly adapter: XtreamProviderAdapter, private readonly catalog: XtreamCatalogSyncService) {}

  onModuleInit() {
    if (!process.env.XTREAM_SYNC_SCHEDULE) return;
    // Invalid schedule fails startup instead of silently ignoring security config.
    this.schedules = parseSyncSchedule(process.env.XTREAM_SYNC_SCHEDULE);
    this.timer = setInterval(() => { void this.tick().catch(() => { /* retry next bounded tick, no raw errors */ }); }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    this.stopped = true; clearInterval(this.timer);
    for (const controller of this.active.values()) controller.abort();
  }
  async tick() {
    if (this.ticking || this.stopped) return;
    this.ticking = true;
    try {
      for (const schedule of this.schedules) {
        if (this.stopped) break;
        try {
          const state = await this.catalog.status(schedule.tenantId, schedule.serverId);
          const latest = Math.max(state.lastSuccessAt?.getTime() || 0, state.lastFailureAt?.getTime() || 0);
          if (Date.now() - latest < schedule.intervalSeconds * 1000) continue;
          await this.run(schedule.tenantId, schedule.serverId, true);
        } catch { /* provider failure never prevents another provider's turn */ }
      }
    } finally { this.ticking = false; }
  }
  async run(tenantId: string, serverId: string, confirmed: boolean) {
    if (!confirmed) throw new BadRequestException('AUTHORIZATION_CONFIRMATION_REQUIRED');
    if (this.stopped) throw new ServiceUnavailableException('SYNC_STOPPED');
    const key = `${tenantId}:${serverId}`;
    if (this.active.has(key) || this.active.size >= 2) throw new ConflictException('SYNC_BUSY');
    const controller = new AbortController(); this.active.set(key, controller);
    try {
      return await this.prisma.$transaction(async tx => {
        const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${`sync-pull:${serverId}`})) AS locked`;
        if (!lock.locked) throw new ConflictException('SYNC_IN_PROGRESS');
        let failure: 'PROVIDER_FETCH_FAILED' | 'PROVIDER_AUTH_REJECTED' | 'SYNC_CANCELLED' = 'PROVIDER_FETCH_FAILED';
        for (let attempt = 0; attempt < 3; attempt++) {
          if (controller.signal.aborted) { failure = 'SYNC_CANCELLED'; break; }
          try {
            const result = await this.servers.retrieveCatalog(tenantId, serverId, this.adapter,
              AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]));
            if (controller.signal.aborted) { failure = 'SYNC_CANCELLED'; break; }
            return await this.catalog.importExport(tenantId, serverId, result, true);
          } catch (error) {
            if (controller.signal.aborted) { failure = 'SYNC_CANCELLED'; break; }
            if (error instanceof Error && error.message === 'PROVIDER_AUTH_REJECTED') { failure = 'PROVIDER_AUTH_REJECTED'; break; }
            if (error instanceof ConflictException) throw error;
            if (attempt < 2) {
              try { await pause(500 * 2 ** attempt, undefined, { signal: controller.signal }); }
              catch { failure = 'SYNC_CANCELLED'; break; }
            }
          }
        }
        // Invalid import records a durable sanitized failure while retaining catalog.
        try { await this.catalog.importExport(tenantId, serverId, undefined, true, failure); }
        catch (error) { if (!(error instanceof BadRequestException && error.message === 'INVALID_CATALOG')) throw new ServiceUnavailableException('SYNC_DIAGNOSTICS_UNAVAILABLE'); }
        throw new ServiceUnavailableException(failure);
      }, { timeout: 60000, maxWait: 2000 });
    } finally { this.active.delete(key); }
  }
}
