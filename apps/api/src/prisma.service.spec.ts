import { PrismaService } from './prisma.service';

describe('Prisma readiness reconnection, no write replay', () => {
  const target = PrismaService.prototype.checkConnection;
  it('does not cycle a healthy connection', async () => {
    const service = { $queryRaw: jest.fn().mockResolvedValue([]), $disconnect: jest.fn(), $connect: jest.fn() };
    await target.call(service as unknown as PrismaService);
    expect(service.$queryRaw).toHaveBeenCalledTimes(1); expect(service.$disconnect).not.toHaveBeenCalled();
  });
  it('reconnects once after a stale pool read failure', async () => {
    const service = { $queryRaw: jest.fn().mockRejectedValueOnce(new Error('stale')).mockResolvedValue([]), $disconnect: jest.fn(), $connect: jest.fn() };
    await target.call(service as unknown as PrismaService);
    expect(service.$disconnect).toHaveBeenCalledTimes(1); expect(service.$connect).toHaveBeenCalledTimes(1); expect(service.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it('propagates an ongoing outage instead of unbounded retry', async () => {
    const service = { $queryRaw: jest.fn().mockRejectedValue(new Error('down')), $disconnect: jest.fn(), $connect: jest.fn().mockRejectedValue(new Error('down')) };
    await expect(target.call(service as unknown as PrismaService)).rejects.toThrow('down');
    expect(service.$connect).toHaveBeenCalledTimes(1);
  });
});
