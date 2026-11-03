import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, q?: string, genre?: string, year?: number, lang?: string, rating?: string) {
    const where: Prisma.TitleWhereInput = {
      tenantId,
      state: 'PUBLISHED',
    };

    if (q) {
      where.OR = [
        { titleAr: { contains: q, mode: 'insensitive' } },
        { titleEn: { contains: q, mode: 'insensitive' } },
        { synopsisAr: { contains: q, mode: 'insensitive' } },
        { synopsisEn: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (genre) {
      where.genres = { has: genre };
    }

    if (year) {
      where.releaseYear = year;
    }

    if (rating) {
      where.maturityRating = rating;
    }

    if (lang) {
      where.originalLanguage = lang;
    }

    return this.prisma.title.findMany({
      where,
      include: {
        seasons: { orderBy: { number: 'asc' } },
      },
      orderBy: { viewsCount: 'desc' },
      take: 50,
    });
  }

  async getTitleDetails(tenantId: string, id: string) {
    const title = await this.prisma.title.findFirst({
      where: { id, tenantId },
      include: {
        seasons: {
          orderBy: { number: 'asc' },
          include: {
            episodes: {
              where: { state: 'PUBLISHED' },
              orderBy: { number: 'asc' },
            },
          },
        },
      },
    });

    if (!title || title.state !== 'PUBLISHED') {
      throw new NotFoundException('Title not found');
    }

    // Increment view count
    await this.prisma.title.update({
      where: { id, tenantId },
      data: { viewsCount: { increment: 1 } },
    });

    return title;
  }

  async getEpisodes(tenantId: string, titleId: string) {
    const title = await this.prisma.title.findFirst({
      where: { id: titleId, tenantId },
      select: { state: true },
    });

    if (!title || title.state !== 'PUBLISHED') {
      throw new NotFoundException('Title not found');
    }

    return this.prisma.episode.findMany({
      where: { titleId, state: 'PUBLISHED' },
      include: { season: true },
      orderBy: { season: { number: 'asc' }, number: 'asc' },
    });
  }

  async getHomeRows(tenantId: string) {
    const homeRows = await this.prisma.homeRow.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
      include: {
        items: {
          where: { title: { tenantId, state: 'PUBLISHED' } },
          orderBy: { order: 'asc' },
          include: { title: true },
        },
      },
    });

    // Also get continue-watching data for the user
    return homeRows;
  }

  async getContinueWatching(tenantId: string, profileId: string, limit = 20) {
    const rows = await this.prisma.watchProgress.findMany({
      where: {
        profileId, completed: false, title: { tenantId, state: 'PUBLISHED' },
        OR: [{ episodeId: null }, { episode: { is: { state: 'PUBLISHED', title: { tenantId, state: 'PUBLISHED' } } } }],
      },
      include: { title: true, episode: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    // Defense in depth for inconsistent historical data: an episode must belong to this title.
    return rows.filter(row => !row.episodeId || (row.episode && row.episode.titleId === row.titleId));
  }

  async getTrending(tenantId: string, limit = 20) {
    return this.prisma.title.findMany({
      where: { tenantId, state: 'PUBLISHED' },
      orderBy: { viewsCount: 'desc' },
      take: limit,
    });
  }

  async getBanners(tenantId: string) {
    return this.prisma.banner.findMany({
      where: { tenantId, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
