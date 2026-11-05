import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../../prisma.service';

describe('EntitlementService', () => {
  let service: EntitlementService;

  const mockPrisma = {
    subscription: {
      findMany: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntitlementService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<EntitlementService>(EntitlementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return allowed: false when no subscriptions', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.playbackSession.count.mockResolvedValue(0);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.playbackSession.findFirst.mockResolvedValue(null);

      const result = await service.check('user-id', 'profile-id', 'device-id', 'title-id');

      expect(result.allowed).toBe(false);
      expect(result.subscriptionActive).toBe(false);
      expect(result.rightsOrRating).toBe(true);
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

  describe('grantSubscription', () => {
    it('should create a new subscription', async () => {
      mockPrisma.subscription.create.mockResolvedValue({
        id: 'sub-id',
        userId: 'user-id',
        planId: 'plan-id',
        status: 'ACTIVE',
      });

      const result = await service.grantSubscription('user-id', 'plan-id');

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

      const result = await service.revokeSubscription('sub-id');

      expect(result.status).toBe('CANCELED');
    });
  });
});
