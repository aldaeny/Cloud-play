import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma, PublishState, Title, Episode } from '@prisma/client';

type TitleUpdate = Partial<Pick<Title, 'titleAr' | 'titleEn' | 'synopsisAr' | 'synopsisEn' | 'releaseYear' | 'runtimeSec' | 'maturityRating' | 'originalLanguage' | 'genres' | 'posterUrl' | 'backdropUrl' | 'state'>>;
type EpisodeUpdate = Partial<Pick<Episode, 'titleAr' | 'titleEn' | 'runtimeSec' | 'state'>>;
type RightsUpdate = { contractRef?: string; territories?: string[]; startsAt?: string | Date; endsAt?: string | Date; approvedBy?: string; approvedAt?: string | Date };


@Injectable()
export class EditorialService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Titles ──────────────────────────────────────────────
  async createTitle(data: {
    tenantId: string;
    kind: 'MOVIE' | 'SERIES';
    titleAr: string;
    titleEn: string;
    maturityRating: string;
    releaseYear?: number;
    runtimeSec?: number;
    originalLanguage?: string;
    genres?: string[];
    synopsisAr?: string;
    synopsisEn?: string;
    posterUrl?: string;
    backdropUrl?: string;
  }) {
    return this.prisma.title.create({
      data: {
        tenantId: data.tenantId,
        kind: data.kind,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        maturityRating: data.maturityRating,
        releaseYear: data.releaseYear,
        runtimeSec: data.runtimeSec,
        originalLanguage: data.originalLanguage,
        genres: data.genres || [],
        synopsisAr: data.synopsisAr,
        synopsisEn: data.synopsisEn,
        posterUrl: data.posterUrl,
        backdropUrl: data.backdropUrl,
        state: 'DRAFT',
      },
    });
  }

  async updateTitle(tenantId: string, id: string, data: TitleUpdate) {
    const title = await this.prisma.title.findFirst({ where: { id, tenantId } });
    if (!title) throw new NotFoundException('Title not found');

    const updateData: Prisma.TitleUpdateInput = {};
    if (data.titleAr) updateData.titleAr = data.titleAr;
    if (data.titleEn) updateData.titleEn = data.titleEn;
    if (data.synopsisAr !== undefined) updateData.synopsisAr = data.synopsisAr;
    if (data.synopsisEn !== undefined) updateData.synopsisEn = data.synopsisEn;
    if (data.releaseYear !== undefined) updateData.releaseYear = data.releaseYear;
    if (data.runtimeSec !== undefined) updateData.runtimeSec = data.runtimeSec;
    if (data.maturityRating) updateData.maturityRating = data.maturityRating;
    if (data.originalLanguage) updateData.originalLanguage = data.originalLanguage;
    if (data.genres) updateData.genres = data.genres;
    if (data.posterUrl !== undefined) updateData.posterUrl = data.posterUrl;
    if (data.backdropUrl !== undefined) updateData.backdropUrl = data.backdropUrl;
    if (data.state) {
      // Validate state transitions
      const validStates = ['DRAFT', 'METADATA_REVIEW', 'RIGHTS_PENDING', 'RIGHTS_APPROVED', 'PROCESSING', 'QC', 'PUBLISHED', 'UNPUBLISHED', 'TAKEDOWN'];
      if (!validStates.includes(data.state)) {
        throw new BadRequestException('Invalid state');
      }
      updateData.state = data.state;
    }

    return this.prisma.title.update({ where: { id, tenantId }, data: updateData });
  }

  async deleteTitle(tenantId: string, id: string) {
    const title = await this.prisma.title.findFirst({ where: { id, tenantId } });
    if (!title) throw new NotFoundException('Title not found');

    await this.prisma.title.delete({ where: { id, tenantId } });
    return { success: true };
  }

  async getTitles(tenantId: string, state?: string) {
    if (state && !Object.values(PublishState).includes(state as PublishState)) throw new BadRequestException('Invalid state');
    return this.prisma.title.findMany({
      where: {
        tenantId,
        ...(state ? { state: state as PublishState } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getTitle(tenantId: string, id: string) {
    const title = await this.prisma.title.findFirst({
      where: { id, tenantId },
      include: { seasons: true, rightsWindows: true, mediaAssets: true },
    });
    if (!title) throw new NotFoundException('Title not found');
    return title;
  }

  // ── Seasons ──────────────────────────────────────────────
  async createSeason(tenantId: string, titleId: string, number: number) {
    await this.assertTitle(tenantId, titleId);
    return this.prisma.season.create({
      data: { titleId, number },
    });
  }

  async deleteSeason(tenantId: string, id: string) {
    const season = await this.prisma.season.findFirst({ where: { id, title: { tenantId } }, select: { id: true } });
    if (!season) throw new NotFoundException('Season not found');
    await this.prisma.season.delete({ where: { id, title: { tenantId } } });
    return { success: true };
  }

  // ── Episodes ─────────────────────────────────────────────
  async createEpisode(tenantId: string, data: {
    seasonId: string;
    titleId: string;
    number: number;
    titleAr: string;
    titleEn: string;
    runtimeSec?: number;
  }) {
    await this.assertTitle(tenantId, data.titleId);
    const season = await this.prisma.season.findFirst({ where: { id: data.seasonId, titleId: data.titleId, title: { tenantId } }, select: { id: true } });
    if (!season) throw new NotFoundException('Season not found for title');
    return this.prisma.episode.create({
      data: {
        seasonId: data.seasonId,
        titleId: data.titleId,
        number: data.number,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        runtimeSec: data.runtimeSec,
        state: 'DRAFT',
      },
    });
  }

  async updateEpisode(tenantId: string, id: string, data: EpisodeUpdate) {
    const episode = await this.prisma.episode.findFirst({ where: { id, title: { tenantId } } });
    if (!episode) throw new NotFoundException('Episode not found');

    const updateData: Prisma.EpisodeUpdateInput = {};
    if (data.titleAr) updateData.titleAr = data.titleAr;
    if (data.titleEn) updateData.titleEn = data.titleEn;
    if (data.runtimeSec !== undefined) updateData.runtimeSec = data.runtimeSec;
    if (data.state) updateData.state = data.state;

    return this.prisma.episode.update({ where: { id, title: { tenantId } }, data: updateData });
  }

  async deleteEpisode(tenantId: string, id: string) {
    const episode = await this.prisma.episode.findFirst({ where: { id, title: { tenantId } }, select: { id: true } });
    if (!episode) throw new NotFoundException('Episode not found');
    await this.prisma.episode.delete({ where: { id, title: { tenantId } } });
    return { success: true };
  }

  async getEpisodes(tenantId: string, titleId: string) {
    await this.assertTitle(tenantId, titleId);
    return this.prisma.episode.findMany({
      where: { titleId },
      include: { season: true, mediaAssets: true },
      orderBy: { season: { number: 'asc' }, number: 'asc' },
    });
  }

  // ── Rights Windows ──────────────────────────────────────
  async createRightsWindow(tenantId: string, data: {
    titleId: string;
    contractRef: string;
    territories: string[];
    startsAt: Date;
    endsAt: Date;
    approvedBy?: string;
  }) {
    await this.assertTitle(tenantId, data.titleId);
    return this.prisma.rightsWindow.create({
      data: {
        titleId: data.titleId,
        contractRef: data.contractRef,
        territories: JSON.stringify(data.territories),
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        approvedBy: data.approvedBy,
      },
    });
  }

  async updateRightsWindow(tenantId: string, id: string, data: RightsUpdate) {
    const window = await this.prisma.rightsWindow.findFirst({ where: { id, title: { tenantId } }, select: { id: true } });
    if (!window) throw new NotFoundException('Rights window not found');
    const updateData: Prisma.RightsWindowUpdateInput = {};
    if (data.contractRef) updateData.contractRef = data.contractRef;
    if (data.territories) updateData.territories = JSON.stringify(data.territories);
    if (data.startsAt) updateData.startsAt = data.startsAt;
    if (data.endsAt) updateData.endsAt = data.endsAt;
    if (data.approvedBy) updateData.approvedBy = data.approvedBy;
    if (data.approvedAt) updateData.approvedAt = data.approvedAt;

    return this.prisma.rightsWindow.update({ where: { id, title: { tenantId } }, data: updateData });
  }

  // ── Home Rows ───────────────────────────────────────────
  async createHomeRow(tenantId: string, name: string, order: number) {
    return this.prisma.homeRow.create({
      data: { tenantId, name, order },
    });
  }

  async addToHomeRow(tenantId: string, homeRowId: string, titleId: string, order: number) {
    await this.assertHomeRow(tenantId, homeRowId);
    await this.assertTitle(tenantId, titleId);
    return this.prisma.homeRowItem.create({
      data: { homeRowId, titleId, order },
    });
  }

  async removeFromHomeRow(tenantId: string, homeRowId: string, titleId: string) {
    await this.assertHomeRow(tenantId, homeRowId);
    return this.prisma.homeRowItem.deleteMany({
      where: { homeRowId, titleId, homeRow: { tenantId } },
    });
  }

  async deleteHomeRow(tenantId: string, id: string) {
    await this.assertHomeRow(tenantId, id);
    await this.prisma.homeRow.delete({ where: { id, tenantId } });
    return { success: true };
  }
  private async assertTitle(tenantId: string, id: string): Promise<void> {
    if (!await this.prisma.title.findFirst({ where: { id, tenantId }, select: { id: true } })) throw new NotFoundException('Title not found');
  }

  private async assertHomeRow(tenantId: string, id: string): Promise<void> {
    if (!await this.prisma.homeRow.findFirst({ where: { id, tenantId }, select: { id: true } })) throw new NotFoundException('Home row not found');
  }
}
