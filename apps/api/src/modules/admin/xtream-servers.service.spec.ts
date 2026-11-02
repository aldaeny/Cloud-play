import { NotFoundException } from '@nestjs/common';
import { XtreamServersService } from './xtream-servers.service';

describe('XtreamServersService', () => {
  const prisma = {
    xtreamServer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  let service: XtreamServersService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.XTREAM_ENCRYPTION_KEY = 'a'.repeat(64);
    service = new XtreamServersService(prisma as never);
  });

  afterAll(() => { delete process.env.XTREAM_ENCRYPTION_KEY; });

  it('stores an encrypted password and never returns it', async () => {
    prisma.xtreamServer.create.mockImplementation(async ({ data }) => ({
      id: 'server-1', ...data, enabled: true, connectionStatus: 'unknown',
    }));

    const result = await service.create('tenant-1', {
      name: 'Primary', baseUrl: 'http://stream.example:2052', username: 'operator', password: 'secret-value',
    });

    const stored = prisma.xtreamServer.create.mock.calls[0][0].data;
    expect(stored.tenantId).toBe('tenant-1');
    expect(stored.passwordEncrypted).not.toBe('secret-value');
    expect(result).not.toHaveProperty('passwordEncrypted');
    expect(result).not.toHaveProperty('password');
  });

  it('scopes list queries to the current tenant', async () => {
    prisma.xtreamServer.findMany.mockResolvedValue([]);
    await service.list('tenant-2');
    expect(prisma.xtreamServer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-2' },
    }));
  });

  it('does not update a server belonging to another tenant', async () => {
    prisma.xtreamServer.findFirst.mockResolvedValue(null);
    await expect(service.update('tenant-2', 'server-1', { name: 'Changed' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.xtreamServer.update).not.toHaveBeenCalled();
  });

  it('rejects loopback and private network URLs', async () => {
    await expect(service.create('tenant-1', {
      name: 'Local', baseUrl: 'http://127.0.0.1:2052', username: 'operator', password: 'secret-value',
    })).rejects.toThrow('Private and loopback server addresses are not allowed');
    expect(prisma.xtreamServer.create).not.toHaveBeenCalled();
  });
});
