import { BadRequestException, NotFoundException } from '@nestjs/common';
import { XtreamServersService } from './xtream-servers.service';

/**
 * Multi-server management: priority, default selection, and bounded failover.
 * The load-bearing properties are tenant isolation, atomic default switching
 * (a failure must not leave a tenant with zero or two defaults), and that
 * credentials never appear in any selection result.
 */
describe('XtreamServersService — multi-server management', () => {
  const TENANT = 'tenant-1';

  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: 's1', tenantId: TENANT, name: 'Primary', baseUrl: 'https://one.example',
      username: 'operator', passwordEncrypted: 'iv.tag.cipher',
      enabled: true, priority: 100, isDefault: false,
      connectionStatus: 'unknown', lastCheckedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
      ...overrides,
    };
  }

  let tx: { xtreamServer: { updateMany: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let prisma: {
    xtreamServer: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: XtreamServersService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.XTREAM_ENCRYPTION_KEY = 'a'.repeat(64);
    tx = {
      xtreamServer: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockImplementation(async ({ data }) => row(data)),
        update: jest.fn().mockImplementation(async ({ data }) => row(data)),
      },
    };
    prisma = {
      xtreamServer: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(row()),
        create: jest.fn().mockImplementation(async ({ data }) => row(data)),
        update: jest.fn().mockImplementation(async ({ data }) => row(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      // Execute the callback synchronously against the transaction client.
      $transaction: jest.fn().mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx)),
    };
    service = new XtreamServersService(prisma as never);
  });

  afterAll(() => { delete process.env.XTREAM_ENCRYPTION_KEY; });

  describe('priority', () => {
    it('sets a valid priority without touching credentials', async () => {
      await service.setPriority(TENANT, 's1', 5);
      const arg = prisma.xtreamServer.update.mock.calls[0][0];
      expect(arg.data).toEqual({ priority: 5 });
      expect(arg.data).not.toHaveProperty('passwordEncrypted');
    });

    it.each([0, -1, 1001, 1.5, NaN, '5', null, undefined])('rejects invalid priority %p', async value => {
      await expect(service.setPriority(TENANT, 's1', value as number)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.xtreamServer.update).not.toHaveBeenCalled();
    });

    it('refuses a server owned by another tenant', async () => {
      prisma.xtreamServer.findFirst.mockResolvedValue(null);
      await expect(service.setPriority('other-tenant', 's1', 5)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.xtreamServer.update).not.toHaveBeenCalled();
    });

    it('validates priority on create before writing', async () => {
      await expect(service.create(TENANT, {
        name: 'Primary', baseUrl: 'https://one.example', username: 'u', password: 'p', priority: 0,
      })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.xtreamServer.create).not.toHaveBeenCalled();
    });
  });

  describe('default selection', () => {
    it('demotes the previous default and promotes the new one in one transaction', async () => {
      await service.setDefault(TENANT, 's1');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.xtreamServer.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, isDefault: true }, data: { isDefault: false },
      });
      expect(tx.xtreamServer.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { isDefault: true } });
      // Demotion must happen before promotion, or the partial unique index trips.
      expect(tx.xtreamServer.updateMany.mock.invocationCallOrder[0])
        .toBeLessThan(tx.xtreamServer.update.mock.invocationCallOrder[0]);
    });

    it('propagates a transaction failure instead of leaving a half-applied default', async () => {
      prisma.$transaction.mockRejectedValue(new Error('deadlock'));
      await expect(service.setDefault(TENANT, 's1')).rejects.toThrow('deadlock');
      expect(prisma.xtreamServer.update).not.toHaveBeenCalled();
    });

    it('refuses to make a disabled server the default', async () => {
      prisma.xtreamServer.findFirst.mockResolvedValue(row({ enabled: false }));
      await expect(service.setDefault(TENANT, 's1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a default belonging to another tenant', async () => {
      prisma.xtreamServer.findFirst.mockResolvedValue(null);
      await expect(service.setDefault('other', 's1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a new default atomically', async () => {
      await service.create(TENANT, {
        name: 'Primary', baseUrl: 'https://one.example', username: 'u', password: 'p', isDefault: true,
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.xtreamServer.updateMany).toHaveBeenCalled();
      expect(tx.xtreamServer.create).toHaveBeenCalled();
    });

    it('creates a non-default without a transaction', async () => {
      await service.create(TENANT, {
        name: 'Primary', baseUrl: 'https://one.example', username: 'u', password: 'p',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.xtreamServer.create).toHaveBeenCalled();
    });

    it('clears the default flag when the default server is disabled', async () => {
      prisma.xtreamServer.findFirst.mockResolvedValue(row({ isDefault: true }));
      await service.toggle(TENANT, 's1', false);
      expect(prisma.xtreamServer.update).toHaveBeenCalledWith({
        where: { id: 's1' }, data: { enabled: false, isDefault: false },
      });
    });

    it('does not clear the flag when disabling a non-default server', async () => {
      prisma.xtreamServer.findFirst.mockResolvedValue(row({ isDefault: false }));
      await service.toggle(TENANT, 's1', false);
      expect(prisma.xtreamServer.update).toHaveBeenCalledWith({
        where: { id: 's1' }, data: { enabled: false },
      });
    });

    it('rejects a non-boolean isDefault', async () => {
      await expect(service.update(TENANT, 's1', { isDefault: 'yes' as unknown as boolean }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('selection queries', () => {
    it('queries only enabled servers for the current tenant', async () => {
      await service.candidates(TENANT);
      expect(prisma.xtreamServer.findMany).toHaveBeenCalledWith({ where: { tenantId: TENANT, enabled: true } });
    });

    it('returns bounded candidates in preference order without credentials', async () => {
      prisma.xtreamServer.findMany.mockResolvedValue([
        row({ id: 'slow', name: 'Slow', priority: 50 }),
        row({ id: 'fast', name: 'Fast', priority: 1 }),
        row({ id: 'off', name: 'Off', priority: 1, enabled: false }),
        row({ id: 'third', name: 'Third', priority: 10 }),
      ]);
      const result = await service.candidates(TENANT, 2);
      expect(result.map(s => s.id)).toEqual(['fast', 'third']);
      for (const server of result) {
        expect(server).not.toHaveProperty('passwordEncrypted');
        expect(server).not.toHaveProperty('password');
      }
    });

    it('caps an absurd attempt budget', async () => {
      prisma.xtreamServer.findMany.mockResolvedValue(
        Array.from({ length: 30 }, (_, i) => row({ id: `s${i}`, name: `s${i}`, priority: i + 1 })),
      );
      expect((await service.candidates(TENANT, 9999)).length).toBeLessThanOrEqual(10);
    });

    it('returns the preferred server, honouring an explicit default', async () => {
      prisma.xtreamServer.findMany.mockResolvedValue([
        row({ id: 'best', name: 'Best', priority: 1 }),
        row({ id: 'chosen', name: 'Chosen', priority: 90, isDefault: true }),
      ]);
      expect((await service.preferred(TENANT))?.id).toBe('chosen');
    });

    it('returns null when no server is enabled', async () => {
      prisma.xtreamServer.findMany.mockResolvedValue([]);
      expect(await service.preferred(TENANT)).toBeNull();
      expect(await service.candidates(TENANT)).toEqual([]);
    });

    it('lists servers in effective selection order', async () => {
      await service.list(TENANT);
      expect(prisma.xtreamServer.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT },
        orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }, { name: 'asc' }],
      });
    });
  });
});
