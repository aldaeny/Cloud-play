import { TenantSettingsService } from './tenant-settings.service';
import { ExternalPlaybackSessionService } from './external-playback-session.service';
import type { PrismaService } from '../../prisma.service';

describe('tenant settings validation and subscription enforcement', () => {
  it.each([{ tenantId: 'foreign' }, { logoUrl: 'javascript:alert(1)' }, { logoUrl: '//tracker/logo.png' }, { cyanGlow: 'var(--evil)' }, { displayName: '' }, []])('rejects unsafe settings before DB access: %j', async body => {
    const transaction = jest.fn();
    const service = new TenantSettingsService({ $transaction: transaction } as unknown as PrismaService);
    await expect(service.saveBranding('tenant-a', 'actor-a', body)).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
  const previous = process.env.FREE_ACCESS;
  afterEach(() => { if (previous === undefined) delete process.env.FREE_ACCESS; else process.env.FREE_ACCESS = previous; });
  const user = { id: 'user-a', tenantId: 'tenant-a', profiles: [] };
  it('enforces active unexpired tenant-scoped subscriptions in protected IPTV mode', async () => {
    process.env.FREE_ACCESS = 'false';
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new ExternalPlaybackSessionService({ subscription: { findFirst } } as unknown as PrismaService);
    await expect(service.subscriptionLimit(user)).rejects.toThrow('ACTIVE_SUBSCRIPTION_REQUIRED');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', user: { tenantId: 'tenant-a' }, status: 'ACTIVE', currentPeriodEnd: { gt: expect.any(Date) }, plan: { tenantId: 'tenant-a', active: true } } }));
    findFirst.mockResolvedValue({ plan: { maxStreams: 3 } });
    await expect(service.subscriptionLimit(user)).resolves.toBe(3);
    findFirst.mockResolvedValue(null);
    await expect(service.subscriptionLimit(user)).rejects.toThrow('ACTIVE_SUBSCRIPTION_REQUIRED');
  });
  it('never queries licensing in explicit free mode', async () => {
    process.env.FREE_ACCESS = 'true';
    const findFirst = jest.fn();
    const service = new ExternalPlaybackSessionService({ subscription: { findFirst } } as unknown as PrismaService);
    await expect(service.subscriptionLimit(user)).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
