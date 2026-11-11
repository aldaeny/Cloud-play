import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

    // Resolve ownership from the database, never caller-supplied tenant claims.
    const user = await this.prisma.appUser.findUnique({ where: { id: userId }, select: { tenantId: true } });
    const title = user && await this.prisma.title.findFirst({ where: { id: titleId, tenantId: user.tenantId, state: 'PUBLISHED' }, select: { id: true } });
    if (!user || !title) throw new NotFoundException('Title not found');
    if (episodeId && !await this.prisma.episode.findFirst({ where: { id: episodeId, titleId, state: 'PUBLISHED' }, select: { id: true } })) throw new NotFoundException('Episode not found');

    // Check active subscriptions. A subscription only grants access while its
    // paid period is still running: an ACTIVE row whose currentPeriodEnd has
    // passed must not allow playback (mirrors BillingService.getCurrentSubscription).
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: now },
        plan: { active: true, tenantId: user.tenantId },
      },
      include: { plan: true },
      orderBy: [{ plan: { maxStreams: 'desc' } }, { currentPeriodEnd: 'desc' }],
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
        endedAt: null,
        OR: [{ vodExpiresAt: null }, { vodExpiresAt: { gt: now } }],
      },
    });
    const maxStreams = plan?.maxStreams || 3;
    const streamLimit = activeSessions < maxStreams;

    // Check device limits. Revoked devices no longer count against the quota.
    const devices = await this.prisma.device.count({
      where: { userId, revokedAt: null },
    });
    const deviceLimit = devices <= (plan?.maxDevices || 5);

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

  async grantSubscription(tenantId: string, userId: string, planId: string, expiresAt?: Date) {
    const user = await this.prisma.appUser.findFirst({ where: { id: userId, tenantId }, select: { id: true } });
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, tenantId, active: true }, select: { id: true } });
    if (!user || !plan) throw new NotFoundException('User or plan not found');
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) throw new BadRequestException('Expiry must be in the future');
    return this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        currentPeriodEnd: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        provider: 'internal-manual',
      },
    });
  }

  async revokeSubscription(tenantId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({ where: { id: subscriptionId, user: { tenantId }, plan: { tenantId } }, select: { id: true } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELED' },
    });
  }
}
