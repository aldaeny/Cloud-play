import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { catalogDiff, normalizeCatalog, XtreamCatalogSyncService } from './xtream-catalog-sync.service';

const empty = () => ({ live: [], movie: [], series: [], liveCategory: [], movieCategory: [], seriesCategory: [] });
describe('provider catalog full-export synchronization', () => {
  it('requires all six complete arrays', () => { expect(() => normalizeCatalog({ live: [] })).toThrow('INVALID_CATALOG'); });
  it('only copies metadata allowlist, never provider URLs/credentials', () => {
    const rows = normalizeCatalog({ ...empty(), live: [{ id: 1, name: 'Fixture', password: 'secret', url: 'https://user:secret@provider.example' }] });
    expect(rows).toEqual([{ kind: 'live', sourceId: '1', name: 'Fixture', categoryId: null }]);
    expect(JSON.stringify(rows)).not.toContain('secret');
  });
  it('keeps the same provider id distinct across content kinds', () => {
    expect(normalizeCatalog({ ...empty(), live: [{ id: 1, name: 'Fixture L' }], movie: [{ id: 1, name: 'Fixture M' }] })).toHaveLength(2);
  });
  it.each([
    { ...empty(), live: [{ id: 1, name: 'A' }, { id: 1, name: 'B' }] },
    { ...empty(), movie: [{ id: 'https://secret', name: 'A' }] },
    { ...empty(), series: [{ id: 1, name: '<script>bad</script>' }] },
    { ...empty(), live: Array(10001).fill({ id: 1, name: 'A' }) },
    { ...empty(), live: [{ id: 1, name: '' }] },
  ])('rejects malformed/duplicate/oversized inputs', input => { expect(() => normalizeCatalog(input)).toThrow('INVALID_CATALOG'); });
  it('detects added, changed and removed metadata', () => {
    const before = normalizeCatalog({ ...empty(), live: [{ id: 1, name: 'Old' }, { id: 2, name: 'Gone' }] });
    const after = normalizeCatalog({ ...empty(), live: [{ id: 1, name: 'New' }, { id: 3, name: 'Added' }] });
    expect(catalogDiff(before, after)).toEqual({ added: 1, changed: 1, removed: 1 });
  });
  it('is stable under input reordering', () => {
    const rows = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    expect(normalizeCatalog({ ...empty(), live: rows })).toEqual(normalizeCatalog({ ...empty(), live: [...rows].reverse() }));
  });
  const tx = { xtreamServer: { findFirst: jest.fn() }, xtreamCatalogSnapshot: { upsert: jest.fn(), update: jest.fn() }, $queryRaw: jest.fn() };
  const prisma = { $transaction: jest.fn(fn => fn(tx)) };
  const service = new XtreamCatalogSyncService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.clearAllMocks();
    tx.xtreamServer.findFirst.mockResolvedValue({ id: 'server' });
    tx.$queryRaw.mockResolvedValue([{ locked: true }]);
    tx.xtreamCatalogSnapshot.upsert.mockResolvedValue({ catalog: [], history: [], revision: 0 });
    tx.xtreamCatalogSnapshot.update.mockResolvedValue({});
  });
  it('requires explicit operator authorization acknowledgement', async () => {
    await expect(service.importExport('tenant', 'server', empty(), false)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('scopes enabled server lookup to the authenticated tenant', async () => {
    tx.xtreamServer.findFirst.mockResolvedValue(null);
    await expect(service.importExport('tenant', 'server', empty(), true)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.xtreamServer.findFirst).toHaveBeenCalledWith({ where: { id: 'server', tenantId: 'tenant', enabled: true }, select: { id: true } });
    expect(tx.xtreamCatalogSnapshot.update).not.toHaveBeenCalled();
  });
  it('rejects concurrent import without updating state', async () => {
    tx.$queryRaw.mockResolvedValue([{ locked: false }]);
    await expect(service.importExport('tenant', 'server', empty(), true)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.xtreamCatalogSnapshot.update).not.toHaveBeenCalled();
  });
  it('records failed imports but preserves the last good catalog', async () => {
    await expect(service.importExport('tenant', 'server', { live: [] }, true)).rejects.toBeInstanceOf(BadRequestException);
    const data = tx.xtreamCatalogSnapshot.update.mock.calls[0][0].data;
    expect(data.catalog).toBeUndefined(); expect(data.lastFailureAt).toBeInstanceOf(Date);
    expect(data.history[0].reason).toBe('INVALID_CATALOG');
  });
  it('bounds persistent history to 20 records', async () => {
    tx.xtreamCatalogSnapshot.upsert.mockResolvedValue({ catalog: [], revision: 20, history: Array(20).fill({ status: 'SUCCEEDED' }) });
    const result = await service.importExport('tenant', 'server', empty(), true);
    expect(result.revision).toBe(21);
    expect(tx.xtreamCatalogSnapshot.update.mock.calls[0][0].data.history).toHaveLength(20);
  });
});
