import { Test } from '@nestjs/testing';
import { PlaybackService } from './playback.service';
import { PrismaService } from '../../prisma.service';
import { RightsService } from '../rights/rights.service';
import { EntitlementService } from '../entitlement/entitlement.service';

/**
 * Free-access gate tests for PlaybackService.
 *
 * The sibling playback.service.spec.ts instantiates the real PrismaService and
 * is blocked in environments where the Prisma engine cannot be generated.
 * This suite mocks the collaborators so the free-access authorization logic is
 * still test-proven without a database.
 */
describe('PlaybackService free access', () => {
  let service: PlaybackService;
  const check = jest.fn();

  beforeEach(async () => {
    check.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlaybackService,
        { provide: PrismaService, useValue: {} },
        { provide: RightsService, useValue: {} },
        { provide: EntitlementService, useValue: { check } },
      ],
    }).compile();

    service = moduleRef.get(PlaybackService);
  });

  it('does not raise SUBSCRIPTION_REQUIRED for a free-access user when rights fail', async () => {
    check.mockResolvedValue({
      allowed: false,
      subscriptionActive: false,
      freeAccess: true,
      rightsOrRating: false,
      streamLimit: true,
      deviceLimit: true,
      resumeAtSec: 0,
    });

    await expect(service.createSession('u', 'p', 'd', 't')).rejects.toThrow('RIGHTS_OR_RATING');
  });

  it('still raises SUBSCRIPTION_REQUIRED when free access is disabled and no subscription exists', async () => {
    check.mockResolvedValue({
      allowed: false,
      subscriptionActive: false,
      freeAccess: false,
      rightsOrRating: true,
      streamLimit: true,
      deviceLimit: true,
      resumeAtSec: 0,
    });

    await expect(service.createSession('u', 'p', 'd', 't')).rejects.toThrow('SUBSCRIPTION_REQUIRED');
  });

  it('still enforces stream limits for free-access users', async () => {
    check.mockResolvedValue({
      allowed: false,
      subscriptionActive: false,
      freeAccess: true,
      rightsOrRating: true,
      streamLimit: false,
      deviceLimit: true,
      resumeAtSec: 0,
    });

    await expect(service.createSession('u', 'p', 'd', 't')).rejects.toThrow('STREAM_LIMIT');
  });

  it('fails closed for entitled free-access users until secure HLS is configured', async () => {
    check.mockResolvedValue({
      allowed: true,
      subscriptionActive: false,
      freeAccess: true,
      rightsOrRating: true,
      streamLimit: true,
      deviceLimit: true,
      resumeAtSec: 0,
    });

    await expect(service.createSession('u', 'p', 'd', 't')).rejects.toThrow('Secure HLS delivery is not configured');
  });
});
