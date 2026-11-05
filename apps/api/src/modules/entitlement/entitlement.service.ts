import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';

export interface EntitlementCheckResult {
  allowed: boolean;
  subscriptionActive: boolean;
  /** True when the product is running in free-access mode (no paywall). */
  freeAccess?: boolean;
  rightsOrRating: boolean;
  streamLimit: boolean;
  deviceLimit: boolean;
  resumeAtSec: number;
}

@Injectable()
export class EntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Cloud Play Iraq is a free product. Free access is the default; an operator
   * can re-enable the subscription gate by setting FREE_ACCESS=false. Free
   * access waives ONLY the payment requirement — rights windows and the
   * stream/device abuse limits below still apply.
   */
  private isFreeAccess(): boolean {
    return this.config.get<string>('FREE_ACCESS', 'true') !== 'false';
  }

  async check(
    userId: string,
    profileId: string,
    deviceId: string,
    titleId: string,
    episodeId?: string,
  ): Promise<EntitlementCheckResult> {
    const now = new Date();

    // Check active subscriptions. A subscription only grants access while its
    // paid period is still running: an ACTIVE row whose currentPeriodEnd has
    // passed must not allow playback (mirrors BillingService.getCurrentSubscription).
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: now },
        plan: { active: true },
      },
      include: { plan: true },
    });
    const subscriptionActive = subscriptions.length > 0;
    const plan = subscriptions[0]?.plan;
    const freeAccess = this.isFreeAccess();

    // Check rights windows
    const rightsWindows = await this.prisma.rightsWindow.findMany({
      where: {
        titleId,
        endsAt: { gte: now },
        startsAt: { lte: now },
      },
    });
    const rightsOrRating = rightsWindows.length > 0;

    // Check stream limits
    const activeSessions = await this.prisma.playbackSession.count({
      where: {
        userId,
        profileId,
        endedAt: null,
      },
    });
    const maxStreams = plan?.maxStreams || 3;
    const streamLimit = activeSessions < maxStreams;

    // Check device limits. Revoked devices no longer count against the quota.
    const devices = await this.prisma.device.count({
      where: { userId, revokedAt: null },
    });
    const deviceLimit = devices < (plan?.maxDevices || 5);

    // Get resume position from last session
    const lastSession = await this.prisma.playbackSession.findFirst({
      where: {
        userId,
        profileId,
        titleId,
        episodeId,
        endedAt: null,
      },
      orderBy: { lastHeartbeatAt: 'desc' },
    });
    const resumeAtSec = lastSession?.positionSec || 0;

    return {
      allowed: (freeAccess || subscriptionActive) && rightsOrRating && streamLimit && deviceLimit,
      subscriptionActive,
      freeAccess,
      rightsOrRating,
      streamLimit,
      deviceLimit,
      resumeAtSec,
    };
  }

  async getActiveSubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });
  }

  async grantSubscription(userId: string, planId: string, expiresAt?: Date) {
    return this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        currentPeriodEnd: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        provider: 'aether',
      },
    });
  }

  async revokeSubscription(subscriptionId: string) {
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELED' },
    });
  }
}
