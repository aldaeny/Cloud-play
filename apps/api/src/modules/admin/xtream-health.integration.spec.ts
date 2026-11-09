import { NotFoundException } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'crypto';
import { XtreamServersService } from './xtream-servers.service';
import { XtreamHealthService } from './xtream-health.service';

/**
 * Health-check integration: persistence, throttling, tenant scoping and the
 * guarantee that a probe never exposes a credential or fabricates a status.
 */
describe('XtreamServersService — health monitoring', () => {
  const TENANT = 'tenant-1';
  const KEY = 'a'.repeat(64);

  function encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(KEY, 'hex'), iv);
    const payload = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), payload].map(part => part.toString('base64')).join('.');
  }

  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: 's1', tenantId: TENANT, name: 'Primary', baseUrl: 'https://provider.example:2053',
      username: 'operator', passwordEncrypted: encrypt('secret-value'),
      enabled: true, priority: 100, isDefault: false,
      connectionStatus: 'unknown', lastCheckedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
      ...overrides,
    };
  }

  let prisma: { xtreamServer: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock } };
  let health: XtreamHealthService;
  let service: XtreamServersService;
  let probe: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.XTREAM_ENCRYPTION_KEY = KEY;
    delete process.env.XTREAM_ALLOW_HTTP;
    prisma = {
      xtreamServer: {
        findFirst: jest.fn().mockResolvedValue(row()),
        findMany: jest.fn().mockResolvedValue([row()]),
        update: jest.fn().mockImplementation(async ({ data }) => row(data)),
      },
    };
    health = new XtreamHealthService();
    service = new XtreamServersService(prisma as never, health);
    probe = jest.spyOn(health, 'probe').mockResolvedValue({
      status: 'healthy', reason: 'OK', latencyMs: 42, httpStatus: 200, checkedAt: new Date(),
    });
  });

  afterEach(() => { jest.restoreAllMocks(); delete process.env.XTREAM_ENCRYPTION_KEY; });

  it('decrypts the stored password for the probe and persists the outcome', async () => {
    const result = await service.checkHealth(TENANT, 's1', true);

    expect(probe).toHaveBeenCalledWith(
      { baseUrl: 'https://provider.example:2053', username: 'operator', password: 'secret-value' },
      false,
    );
    expect(prisma.xtreamServer.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: expect.objectContaining({ connectionStatus: 'healthy', lastCheckedAt: expect.any(Date) }),
    });
    expect(result).toMatchObject({ skipped: false, reason: 'OK', latencyMs: 42 });
  });

  it('never returns the credential, encrypted or plaintext', async () => {
    const result = await service.checkHealth(TENANT, 's1', true);
    const serialized = JSON.stringify(result);
    expect(result).not.toHaveProperty('passwordEncrypted');
    expect(result).not.toHaveProperty('password');
    expect(serialized).not.toContain('secret-value');
  });

  it('persists an unreachable origin as unhealthy, never as healthy', async () => {
    probe.mockResolvedValue({ status: 'unhealthy', reason: 'ORIGIN_UNREACHABLE', latencyMs: null, httpStatus: 521, checkedAt: new Date() });
    const result = await service.checkHealth(TENANT, 's1', true);
    expect(prisma.xtreamServer.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: expect.objectContaining({ connectionStatus: 'unhealthy' }),
    });
    expect(result.reason).toBe('ORIGIN_UNREACHABLE');
  });

  it('skips a recently checked server without probing when not forced', async () => {
    prisma.xtreamServer.findFirst.mockResolvedValue(row({ lastCheckedAt: new Date(), connectionStatus: 'healthy' }));
    const result = await service.checkHealth(TENANT, 's1');
    expect(probe).not.toHaveBeenCalled();
    expect(prisma.xtreamServer.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: true, reason: 'RECENTLY_CHECKED' });
  });

  it('probes again when the recorded check is stale', async () => {
    prisma.xtreamServer.findFirst.mockResolvedValue(row({ lastCheckedAt: new Date(Date.now() - 120_000) }));
    await service.checkHealth(TENANT, 's1');
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('honours an explicit operator force even within the interval', async () => {
    prisma.xtreamServer.findFirst.mockResolvedValue(row({ lastCheckedAt: new Date() }));
    await service.checkHealth(TENANT, 's1', true);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('refuses a server belonging to another tenant', async () => {
    prisma.xtreamServer.findFirst.mockResolvedValue(null);
    await expect(service.checkHealth('other', 's1', true)).rejects.toBeInstanceOf(NotFoundException);
    expect(probe).not.toHaveBeenCalled();
    expect(prisma.xtreamServer.update).not.toHaveBeenCalled();
  });

  it('passes the HTTP allowance through from configuration', async () => {
    process.env.XTREAM_ALLOW_HTTP = 'true';
    await service.checkHealth(TENANT, 's1', true);
    expect(probe).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('fails closed when the stored credential cannot be decrypted', async () => {
    prisma.xtreamServer.findFirst.mockResolvedValue(row({ passwordEncrypted: 'not-valid-ciphertext' }));
    await expect(service.checkHealth(TENANT, 's1', true)).rejects.toThrow('Stored credential');
    expect(probe).not.toHaveBeenCalled();
  });

  it('fails closed when the ciphertext was tampered with', async () => {
    const parts = encrypt('secret-value').split('.');
    parts[2] = Buffer.from('tampered').toString('base64');
    prisma.xtreamServer.findFirst.mockResolvedValue(row({ passwordEncrypted: parts.join('.') }));
    await expect(service.checkHealth(TENANT, 's1', true)).rejects.toThrow('could not be decrypted');
    expect(probe).not.toHaveBeenCalled();
  });

  describe('bounded sweep', () => {
    it('caps the number of servers queried and never forces a recheck', async () => {
      prisma.xtreamServer.findMany.mockResolvedValue([row({ id: 's1' }), row({ id: 's2', name: 'Second' })]);
      prisma.xtreamServer.findFirst.mockImplementation(async ({ where }) => row({ id: where.id }));

      const summary = await service.checkAllHealth(TENANT);

      const query = prisma.xtreamServer.findMany.mock.calls[0][0];
      expect(query.where).toEqual({ tenantId: TENANT, enabled: true });
      expect(query.take).toBeLessThanOrEqual(10);
      expect(summary.checked).toBe(2);
      expect(summary.results).toHaveLength(2);
    });

    it('reports skipped servers separately from checked ones', async () => {
      prisma.xtreamServer.findMany.mockResolvedValue([row({ id: 'fresh' }), row({ id: 'recent', name: 'Recent' })]);
      prisma.xtreamServer.findFirst.mockImplementation(async ({ where }) =>
        where.id === 'recent' ? row({ id: 'recent', lastCheckedAt: new Date() }) : row({ id: 'fresh' }));

      const summary = await service.checkAllHealth(TENANT);
      expect(summary.checked).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(probe).toHaveBeenCalledTimes(1);
    });

    it('handles an empty server list without probing', async () => {
      prisma.xtreamServer.findMany.mockResolvedValue([]);
      const summary = await service.checkAllHealth(TENANT);
      expect(summary).toEqual({ checked: 0, skipped: 0, results: [] });
      expect(probe).not.toHaveBeenCalled();
    });
  });
});
