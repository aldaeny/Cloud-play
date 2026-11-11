import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../../prisma.service';

describe('EntitlementService', () => {
  let service: EntitlementService;

  const mockPrisma = {
    appUser: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-a' }), findFirst: jest.fn().mockResolvedValue({ id: 'user-id' }) },
    title: { findFirst: jest.fn().mockResolvedValue({ id: 'title-id' }) },
    episode: { findFirst: jest.fn() },
    plan: { findFirst: jest.fn().mockResolvedValue({ id: 'plan-id' }) },
    subscription: {
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({ id: 'sub-id' }),
      create: jest.fn(),
      update: jest.fn(),
    },
    rightsWindow: {
      findMany: jest.fn(),
    },
    playbackSession: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    device: {
      count: jest.fn(),
    },
  };

  // Free access is the product default; tests flip this to exercise the gate.
  const mockConfig = { get: jest.fn((key: string, fallback?: string) => (key === 'FREE_ACCESS' ? process.env.TEST_FREE_ACCESS ?? fallback : fallback)) };

  beforeEach(async () => {
    delete process.env.TEST_FREE_ACCESS;
    mockConfig.get.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EntitlementService>(EntitlementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return allowed: false when no subscriptions and free access is disabled', async () => {
      process.env.TEST_FREE_ACCESS = 'false';
      mockPrisma.subscription.findMany.mockResolvedValue([]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.playbackSession.count.mockResolvedValue(0);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      const result = await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(result.allowed).toBe(false);
      expect(result.subscriptionActive).toBe(false);
      expect(result.freeAccess).toBe(false);
      expect(result.rightsOrRating).toBe(true);
    });

    it('allows playback without a subscription in free-access mode (default)', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.playbackSession.count.mockResolvedValue(0);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      const result = await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(result.allowed).toBe(true);
      expect(result.subscriptionActive).toBe(false);
      expect(result.freeAccess).toBe(true);
      expect(result.rightsOrRating).toBe(true);
    });

    it('still enforces rights windows in free-access mode', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([]);
      mockPrisma.playbackSession.count.mockResolvedValue(0);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      const result = await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(result.freeAccess).toBe(true);
      expect(result.rightsOrRating).toBe(false);
      expect(result.allowed).toBe(false);
    });

    it('still enforces stream limits in free-access mode', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.playbackSession.count.mockResolvedValue(3);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      const result = await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(result.freeAccess).toBe(true);
      expect(result.streamLimit).toBe(false);
      expect(result.allowed).toBe(false);
    });

    it('still enforces device limits in free-access mode', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.playbackSession.count.mockResolvedValue(0);
      mockPrisma.device.count.mockResolvedValue(5);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      const result = await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(result.freeAccess).toBe(true);
      expect(result.deviceLimit).toBe(false);
      expect(result.allowed).toBe(false);
    });

    it('should return allowed: true when all checks pass', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([
        { id: 'sub-id', plan: { maxStreams: 3, maxDevices: 5, active: true } },
      ]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.playbackSession.count.mockResolvedValue(1);
      mockPrisma.device.count.mockResolvedValue(2);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      const result = await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(result.allowed).toBe(true);
      expect(result.subscriptionActive).toBe(true);
      expect(result.rightsOrRating).toBe(true);
      expect(result.streamLimit).toBe(true);
      expect(result.deviceLimit).toBe(true);
    });

    it('should return allowed: false when stream limit reached', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([
        { id: 'sub-id', plan: { maxStreams: 3, maxDevices: 5, active: true } },
      ]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.playbackSession.count.mockResolvedValue(3);
      mockPrisma.device.count.mockResolvedValue(2);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      const result = await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(result.allowed).toBe(false);
      expect(result.streamLimit).toBe(false);
    });

    it('excludes expired subscriptions (currentPeriodEnd must be in the future)', async () => {
      process.env.TEST_FREE_ACCESS = 'false';
      mockPrisma.subscription.findMany.mockResolvedValue([]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.playbackSession.count.mockResolvedValue(0);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      const result = await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(result.subscriptionActive).toBe(false);
      expect(result.allowed).toBe(false);
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            currentPeriodEnd: { gt: expect.any(Date) },
          }),
        }),
      );
    });

    it('does not count revoked devices against the device limit', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([
        { id: 'sub-id', plan: { maxStreams: 3, maxDevices: 5, active: true } },
      ]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.playbackSession.count.mockResolvedValue(0);
      mockPrisma.device.count.mockResolvedValue(2);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(mockPrisma.device.count).toHaveBeenCalledWith({
        where: { userId: 'user-id', revokedAt: null },
      });
    });
  });

  it('rejects a cross-tenant title before querying subscriptions', async () => {
    mockPrisma.title.findFirst.mockResolvedValueOnce(null);
    await expect(service.check('user-id', 'profile-id', 'device-id', 'other-title')).rejects.toThrow('Title not found');
    expect(mockPrisma.title.findFirst).toHaveBeenLastCalledWith({ where: { id: 'other-title', tenantId: 'tenant-a', state: 'PUBLISHED' }, select: { id: true } });
  });

  it('counts streams across all profiles, not just the requesting profile', async () => {
    await service.check('user-id', 'profile-id', 'device-id', 'title-id');
    expect(mockPrisma.playbackSession.count).toHaveBeenLastCalledWith({ where: { userId: 'user-id', endedAt: null } });
  });

  it('cannot grant another tenant plan', async () => {
    mockPrisma.plan.findFirst.mockResolvedValueOnce(null);
    await expect(service.grantSubscription('tenant-a', 'user-id', 'plan-b')).rejects.toThrow('User or plan not found');
  });

  it('cannot revoke another tenant subscription', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValueOnce(null);
    await expect(service.revokeSubscription('tenant-a', 'sub-b')).rejects.toThrow('Subscription not found');
  });

  describe('grantSubscription', () => {
    it('should create a new subscription', async () => {
      mockPrisma.subscription.create.mockResolvedValue({
        id: 'sub-id',
        userId: 'user-id',
        planId: 'plan-id',
        status: 'ACTIVE',
      });

      const result = await service.grantSubscription('tenant-a', 'user-id', 'plan-id');

      expect(result).toHaveProperty('id', 'sub-id');
      expect(mockPrisma.subscription.create).toHaveBeenCalled();
    });
  });

  describe('revokeSubscription', () => {
    it('should update subscription status to CANCELED', async () => {
      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub-id',
        status: 'CANCELED',
      });

      const result = await service.revokeSubscription('tenant-a', 'sub-id');

      expect(result.status).toBe('CANCELED');
    });
  });
});
