import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

export const CATALOG_KINDS = ['live', 'movie', 'series', 'liveCategory', 'movieCategory', 'seriesCategory'] as const;
type Kind = typeof CATALOG_KINDS[number];
export type CatalogRow = { kind: Kind; sourceId: string; name: string; categoryId: string | null };
const MAX_ROWS = 10000;
const MAX_BYTES = 1024 * 1024;

/** Full metadata export, not playback data. All six arrays required: partial
 * failures must never be interpreted as mass removals. Never copies raw objects. */
export function normalizeCatalog(input: unknown): CatalogRow[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_CATALOG');
  const result: CatalogRow[] = [];
  const seen = new Set<string>();
  const identifier = (value: unknown): string => {
    const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
    if (typeof text !== 'string' || !/^[a-zA-Z0-9_.-]{1,128}$/.test(text)) throw new Error('INVALID_CATALOG');
    return text;
  };
  for (const kind of CATALOG_KINDS) {
    const rows = (input as Record<string, unknown>)[kind];
    if (!Array.isArray(rows) || result.length + rows.length > MAX_ROWS) throw new Error('INVALID_CATALOG');
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('INVALID_CATALOG');
      const sourceId = identifier(row.id);
      const name = row.name;
      if (typeof name !== 'string' || !name.trim() || name.length > 200 || (/[<>]/.test(name) || [...name].some(char => char.charCodeAt(0) < 32))) throw new Error('INVALID_CATALOG');
      const key = `${kind}:${sourceId}`;
      if (seen.has(key)) throw new Error('INVALID_CATALOG');
      seen.add(key);
      result.push({ kind, sourceId, name: name.trim(), categoryId: row.categoryId == null ? null : identifier(row.categoryId) });
    }
  }
  result.sort((a, b) => `${a.kind}:${a.sourceId}`.localeCompare(`${b.kind}:${b.sourceId}`));
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_BYTES) throw new Error('INVALID_CATALOG');
  return result;
}

export function catalogDiff(before: CatalogRow[], after: CatalogRow[]) {
  const old = new Map(before.map(row => [`${row.kind}:${row.sourceId}`, JSON.stringify(row)]));
  const next = new Map(after.map(row => [`${row.kind}:${row.sourceId}`, JSON.stringify(row)]));
  return { added: [...next.keys()].filter(key => !old.has(key)).length,
    changed: [...next].filter(([key, value]) => old.has(key) && old.get(key) !== value).length,
    removed: [...old.keys()].filter(key => !next.has(key)).length };
}

/** Durable full-export import synchronization; no provider network or scheduler.
 * This safe incremental surface intentionally cannot contact blocked origins. */
@Injectable()
export class XtreamCatalogSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async status(tenantId: string, serverId: string) {
    const server = await this.prisma.xtreamServer.findFirst({ where: { id: serverId, tenantId }, select: { id: true } });
    if (!server) throw new NotFoundException('Xtream server not found');
    const state = await this.prisma.xtreamCatalogSnapshot.findUnique({ where: { serverId } });
    return state ? { revision: state.revision, itemCount: (state.catalog as unknown as CatalogRow[]).length,
      lastSuccessAt: state.lastSuccessAt, lastFailureAt: state.lastFailureAt, history: state.history } :
      { revision: 0, itemCount: 0, lastSuccessAt: null, lastFailureAt: null, history: [] };
  }

  async importExport(tenantId: string, serverId: string, input: unknown, authorizationConfirmed: boolean, failureReason: 'INVALID_CATALOG' | 'PROVIDER_FETCH_FAILED' | 'PROVIDER_AUTH_REJECTED' | 'SYNC_CANCELLED' = 'INVALID_CATALOG') {
    if (authorizationConfirmed !== true) throw new BadRequestException('AUTHORIZATION_CONFIRMATION_REQUIRED');
    let catalog: CatalogRow[] = [], invalid = false;
    try { catalog = normalizeCatalog(input); } catch { invalid = true; }
    const result = await this.prisma.$transaction(async tx => {
      const server = await tx.xtreamServer.findFirst({ where: { id: serverId, tenantId, enabled: true }, select: { id: true } });
      if (!server) throw new NotFoundException('Enabled Xtream server not found');
      // Cross-process lock scoped to this short DB-only import. No network held
      // inside a transaction; a busy provider is rejected, not queued forever.
      const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${serverId})) AS locked`;
      if (!lock.locked) throw new ConflictException('SYNC_IN_PROGRESS');
      const state = await tx.xtreamCatalogSnapshot.upsert({ where: { serverId }, create: { serverId }, update: {} });
      const at = new Date();
      const diff = invalid ? { added: 0, changed: 0, removed: 0 } : catalogDiff(state.catalog as unknown as CatalogRow[], catalog);
      const event = { revision: state.revision + 1, at: at.toISOString(), status: invalid ? 'FAILED' : 'SUCCEEDED',
        reason: invalid ? failureReason : 'OK', ...diff };
      const history = [event, ...(Array.isArray(state.history) ? state.history : [])].slice(0, 20);
      await tx.xtreamCatalogSnapshot.update({ where: { serverId }, data: {
        revision: { increment: 1 }, history: history as Prisma.InputJsonValue,
        ...(invalid ? { lastFailureAt: at } : { catalog: catalog as unknown as Prisma.InputJsonValue, lastSuccessAt: at }),
      } });
      return { invalid, ...event, itemCount: invalid ? (state.catalog as unknown as CatalogRow[]).length : catalog.length };
    });
    // Throw after commit so failed imports retain diagnostics and the old catalog.
    if (result.invalid) throw new BadRequestException('INVALID_CATALOG');
    const { invalid: _invalid, ...safe } = result;
    return safe;
  }
}
