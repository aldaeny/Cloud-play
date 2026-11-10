import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PlaybackService } from './playback.service';
import { PrismaService } from '../../prisma.service';
import { RightsService } from '../rights/rights.service';
import { EntitlementService } from '../entitlement/entitlement.service';

describe('PlaybackService', () => {
  let service: PlaybackService;
  let prisma: PrismaService;
  let entitlementService: EntitlementService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlaybackService,
        PrismaService,
        RightsService,
        EntitlementService,
        // EntitlementService takes ConfigService; without it Nest cannot build
        // the graph. Mirror entitlement.service.spec.ts: free access stays the
        // product default, and these tests stub `check` per case anyway.
        { provide: ConfigService, useValue: { get: jest.fn((_key: string, fallback?: unknown) => fallback) } },
      ],
    }).compile();

    service = moduleRef.get<PlaybackService>(PlaybackService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
    entitlementService = moduleRef.get<EntitlementService>(EntitlementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('fails closed for entitled users until secure HLS is configured', async () => {
      jest.spyOn(entitlementService, 'check').mockResolvedValue({ allowed: true, subscriptionActive: true, rightsOrRating: true, streamLimit: true, deviceLimit: true, resumeAtSec: 300 });
      const create = jest.spyOn(prisma.playbackSession, 'create');
      await expect(service.createSession('user-1', 'profile-1', 'device-1', 'title-1')).rejects.toThrow('Secure HLS delivery is not configured');
      expect(create).not.toHaveBeenCalled();
    });

    it('should throw SUBSCRIPTION_REQUIRED when no active subscription', async () => {
      const mockEntitlement = {
        allowed: false,
        subscriptionActive: false,
        rightsOrRating: true,
        streamLimit: true,
        deviceLimit: true,
        resumeAtSec: 0,
      };
      jest.spyOn(entitlementService, 'check').mockResolvedValue(mockEntitlement);

      await expect(service.createSession('user-1', 'profile-1', 'device-1', 'title-1'))
        .rejects.toThrow('SUBSCRIPTION_REQUIRED');
    });
  });

  describe('heartbeat', () => {
    it('updates only an active session belonging to the user', async () => {
      const update = jest.spyOn(prisma.playbackSession, 'updateMany').mockResolvedValue({ count: 1 });
      expect((await service.heartbeat('session-1', 'user-1')).success).toBe(true);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({where: {id:'session-1', userId:'user-1', endedAt:null}}));
    });
    it('rejects an absent or foreign session', async () => {
      jest.spyOn(prisma.playbackSession, 'updateMany').mockResolvedValue({count:0});
      await expect(service.heartbeat('session-1', 'user-2')).rejects.toThrow();
    });
  });
  describe('endSession', () => {
    it('ends only an active session belonging to the user', async () => {
      const update = jest.spyOn(prisma.playbackSession, 'updateMany').mockResolvedValue({count:1});
      expect((await service.endSession('session-1', 'user-1')).success).toBe(true);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({where: {id:'session-1', userId:'user-1', endedAt:null}}));
    });
  });
});
