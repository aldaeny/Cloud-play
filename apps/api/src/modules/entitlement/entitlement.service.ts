import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface EntitlementCheckResult {
  allowed: boolean;
  subscriptionActive: boolean;
  rightsOrRating: boolean;
  streamLimit: boolean;
  deviceLimit: boolean;
  resumeAtSec: number;
}

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async check(
    userId: string,
    profileId: string,
    deviceId: string,
    titleId: string,
    episodeId?: string,
  ): Promise<EntitlementCheckResult> {
    // Check active subscriptions
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        plan: { active: true },
      },
      include: { plan: true },
    });
    const subscriptionActive = subscriptions.length > 0;
    const plan = subscriptions[0]?.plan;

    // Check rights windows
    const now = new Date();
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

    // Check device limits
    const devices = await this.prisma.device.count({
      where: { userId },
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
      allowed: subscriptionActive && rightsOrRating && streamLimit && deviceLimit,
      subscriptionActive,
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
