import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(tenantId: string) {
    const [titles, users, publishedTitles, activeSubscriptions, totalViews] = await Promise.all([
      this.prisma.title.count({ where: { tenantId } }),
      this.prisma.appUser.count({ where: { tenantId } }),
      this.prisma.title.count({ where: { tenantId, state: 'PUBLISHED' } }),
      this.prisma.subscription.count({ where: { plan: { tenantId }, status: 'ACTIVE' } }),
      this.prisma.title.aggregate({ _sum: { viewsCount: true }, where: { tenantId } }),
    ]);

    return {
      titles,
      publishedTitles,
      users,
      activeSubscriptions,
      totalViews: totalViews._sum.viewsCount || 0,
    };
  }

  async getTitlesStats(tenantId: string, limit = 20) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be an integer between 1 and 100');
    return this.prisma.title.findMany({
      where: { tenantId, state: 'PUBLISHED' },
      select: {
        id: true,
        titleEn: true,
        titleAr: true,
        viewsCount: true,
        ratingAverage: true,
        ratingCount: true,
      },
      orderBy: { viewsCount: 'desc' },
      take: limit,
    });
  }

  async getPlaybackStats(tenantId: string, days = 7) {
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new BadRequestException('days must be an integer between 1 and 365');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [sessionCount, avgDuration, topTitles] = await Promise.all([
      this.prisma.playbackSession.count({
        where: { title: { tenantId }, startedAt: { gte: since } },
      }),
      this.prisma.playbackSession.aggregate({
        _avg: { positionSec: true },
        where: { title: { tenantId }, startedAt: { gte: since } },
      }),
      this.prisma.title.findMany({
        where: { tenantId, state: 'PUBLISHED' },
        select: { id: true, titleEn: true, titleAr: true },
        orderBy: { viewsCount: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalSessions: sessionCount,
      avgWatchTimeSec: avgDuration._avg.positionSec || 0,
      topTitles,
    };
  }

  async getUserStats(tenantId: string) {
    const [total, active, withSub] = await Promise.all([
      this.prisma.appUser.count({ where: { tenantId } }),
      this.prisma.appUser.count({ where: { tenantId, status: 'active' } }),
      this.prisma.appUser.count({
        where: { tenantId, subscriptions: { some: { status: 'ACTIVE' } } },
      }),
    ]);

    return {
      totalUsers: total,
      activeUsers: active,
      payingUsers: withSub,
      conversionRate: total > 0 ? ((withSub / total) * 100).toFixed(2) : '0',
    };
  }

  async getDeviceStats(tenantId: string) {
    return this.prisma.device.groupBy({
      by: ['platform'],
      where: { user: { tenantId } },
      _count: { _all: true },
    });
  }
}
