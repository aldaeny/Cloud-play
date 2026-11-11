import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { XtreamServersService } from './xtream-servers.service';
import { XtreamProviderAdapter } from './xtream-provider.adapter';
import { XtreamCatalogSyncService } from './xtream-catalog-sync.service';
import { XtreamSyncRunner, parseSyncSchedule } from './xtream-sync-runner.service';

describe('authorized provider pull runner (DB/network fixture dependencies)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const serverId = '22222222-2222-4222-8222-222222222222';
  let runner: XtreamSyncRunner;
  const query = jest.fn();
  const retrieve = jest.fn();
  const persist = jest.fn();
  const status = jest.fn();
  const prisma = { $transaction: jest.fn(async fn => fn({ $queryRaw: query })) };
  beforeEach(() => {
    jest.clearAllMocks(); query.mockResolvedValue([{ locked: true }]);
    retrieve.mockResolvedValue({ live: [] }); persist.mockResolvedValue({ status: 'SUCCEEDED' });
    runner = new XtreamSyncRunner(prisma as unknown as PrismaService,
      { retrieveCatalog: retrieve } as unknown as XtreamServersService, {} as XtreamProviderAdapter,
      { importExport: persist, status } as unknown as XtreamCatalogSyncService);
  });
  afterEach(() => runner.onModuleDestroy());
  it('requires authorization confirmation before locking or contacting providers', async () => {
    await expect(runner.run(tenantId, serverId, false)).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled(); expect(retrieve).not.toHaveBeenCalled();
  });
  it('persists only a complete successful response scoped to the verified tenant', async () => {
    await expect(runner.run(tenantId, serverId, true)).resolves.toEqual({ status: 'SUCCEEDED' });
    expect(retrieve).toHaveBeenCalledWith(tenantId, serverId, expect.anything(), expect.any(AbortSignal));
    expect(persist).toHaveBeenCalledWith(tenantId, serverId, { live: [] }, true);
  });
  it('does not contact provider when another connection holds distributed lock', async () => {
    query.mockResolvedValue([{ locked: false }]);
    await expect(runner.run(tenantId, serverId, true)).rejects.toMatchObject({ status: 409 });
    expect(retrieve).not.toHaveBeenCalled();
  });
  it('does not retry rejected credentials, persists sanitized failure only', async () => {
    retrieve.mockRejectedValue(new Error('PROVIDER_AUTH_REJECTED'));
    persist.mockRejectedValue(new BadRequestException('INVALID_CATALOG'));
    await expect(runner.run(tenantId, serverId, true)).rejects.toThrow('PROVIDER_AUTH_REJECTED');
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(tenantId, serverId, undefined, true, 'PROVIDER_AUTH_REJECTED');
  });
  it('retries transient failure with backoff then commits success', async () => {
    retrieve.mockRejectedValueOnce(new Error('private-url-and-secret')).mockResolvedValueOnce({ live: [] });
    await expect(runner.run(tenantId, serverId, true)).resolves.toEqual({ status: 'SUCCEEDED' });
    expect(retrieve).toHaveBeenCalledTimes(2); expect(persist).toHaveBeenCalledTimes(1);
  });
  it('rejects duplicate local runs, releases the slot after failure and permits another provider', async () => {
    let unblock!: (value: unknown) => void;
    retrieve.mockImplementationOnce(() => new Promise(resolve => { unblock = resolve; }));
    const job = runner.run(tenantId, serverId, true);
    await new Promise(resolve => setImmediate(resolve));
    await expect(runner.run(tenantId, serverId, true)).rejects.toMatchObject({ status: 409 });
    await expect(runner.run(tenantId, '33333333-3333-4333-8333-333333333333', true)).resolves.toMatchObject({ status: 'SUCCEEDED' });
    unblock({ live: [] }); await job;
    await expect(runner.run(tenantId, serverId, true)).resolves.toMatchObject({ status: 'SUCCEEDED' });
  });
  it('refuses work after shutdown', async () => {
    runner.onModuleDestroy();
    await expect(runner.run(tenantId, serverId, true)).rejects.toThrow('SYNC_STOPPED');
  });
  it('validates bounded schedules and explicit provider authorization', () => {
    const valid = { tenantId, serverId, intervalSeconds: 300, authorizationConfirmed: true };
    expect(parseSyncSchedule(JSON.stringify([valid]))).toEqual([valid]);
    for (const input of [null, {}, [{ ...valid, intervalSeconds: 1 }], [{ ...valid, authorizationConfirmed: false }],
      [{ ...valid, tenantId: 'forged' }], [valid, valid]]) expect(() => parseSyncSchedule(JSON.stringify(input))).toThrow();
  });
  it('scheduler skips recent success/failure and continues independently after a provider error', async () => {
    const previous = process.env.XTREAM_SYNC_SCHEDULE;
    process.env.XTREAM_SYNC_SCHEDULE = JSON.stringify([
      { tenantId, serverId, intervalSeconds: 300, authorizationConfirmed: true },
      { tenantId, serverId: '33333333-3333-4333-8333-333333333333', intervalSeconds: 300, authorizationConfirmed: true },
    ]);
    try {
      runner.onModuleInit();
      status.mockResolvedValueOnce({ lastFailureAt: new Date(), lastSuccessAt: null }).mockResolvedValueOnce({ lastFailureAt: null, lastSuccessAt: null });
      await runner.tick(); expect(retrieve).toHaveBeenCalledTimes(1);
      status.mockRejectedValueOnce(new Error('failed first')).mockResolvedValueOnce({ lastFailureAt: null, lastSuccessAt: null });
      await runner.tick(); expect(retrieve).toHaveBeenCalledTimes(2);
    } finally { if (previous === undefined) delete process.env.XTREAM_SYNC_SCHEDULE; else process.env.XTREAM_SYNC_SCHEDULE = previous; }
  });
});
