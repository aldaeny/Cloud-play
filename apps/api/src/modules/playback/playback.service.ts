import { Injectable, ForbiddenException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RightsService } from '../rights/rights.service';
import { EntitlementService } from '../entitlement/entitlement.service';

@Injectable()
export class PlaybackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rightsService: RightsService,
    private readonly entitlementService: EntitlementService,
  ) {}

  async createSession(
    userId: string,
    profileId: string,
    deviceId: string,
    titleId: string,
    episodeId?: string,
  ) {
    // 1. Check Entitlement (Subscription, Rights, Rating, Limits)
    const entitlement = await this.entitlementService.check(
      userId,
      profileId,
      deviceId,
      titleId,
      episodeId,
    );

    if (!entitlement.allowed) {
      if (!entitlement.subscriptionActive && !entitlement.freeAccess) throw new ForbiddenException('SUBSCRIPTION_REQUIRED', { cause: new Error('402') });
      if (!entitlement.rightsOrRating) throw new ForbiddenException('RIGHTS_OR_RATING', { cause: new Error('403') });
      if (!entitlement.streamLimit) throw new ConflictException('STREAM_LIMIT', { cause: new Error('409') });
      if (!entitlement.deviceLimit) throw new ConflictException('DEVICE_LIMIT', { cause: new Error('409') });
    }

    // Fail closed until the HLS origin validates authorization on every object request.
    throw new ServiceUnavailableException('Secure HLS delivery is not configured');
  }

  async heartbeat(sessionId: string, userId: string) {
    const result = await this.prisma.playbackSession.updateMany({
      where: { id: sessionId, userId, endedAt: null },
      data: { lastHeartbeatAt: new Date() },
    });
    if (result.count !== 1) throw new ConflictException('Session not found or ended');
    return { success: true, nextHeartbeatInSec: 30 };
  }

  async endSession(sessionId: string, userId: string) {
    const result = await this.prisma.playbackSession.updateMany({
      where: { id: sessionId, userId, endedAt: null },
      data: { endedAt: new Date() },
    });
    if (result.count !== 1) throw new ConflictException('Session not found or ended');
    return { success: true };
  }
}
