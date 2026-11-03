import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PlaybackService } from './playback.service';
import { PrismaService } from '../../prisma.service';
import { randomUUID } from 'crypto';
import type { WatchProgress } from '@prisma/client';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type UserRequest } from '../../common/permissions.decorator';
import { CreatePlaybackDto, UpdateProgressDto } from './playback.dto';

@Controller('playback')
@UseGuards(JwtAuthGuard)
export class PlaybackController {
  constructor(
    private readonly playbackService: PlaybackService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('sessions')
  async createSession(
    @CurrentUser() user: UserRequest,
    @Body() dto: CreatePlaybackDto,
  ) {
    if (!dto.titleId) {
      throw new BadRequestException('titleId is required');
    }

    const deviceId = dto.deviceId;
    const profileId = dto.profileId || user.profiles[0];
    if (!deviceId || !profileId) throw new BadRequestException('deviceId and profileId are required');
    if (!user.profiles.includes(profileId)) throw new ForbiddenException('Profile does not belong to user');
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId: user.id, revokedAt: null }, select: { id: true } });
    if (!device) throw new ForbiddenException('Device does not belong to user or is revoked');

    return this.playbackService.createSession(
      user.id,
      profileId,
      deviceId,
      dto.titleId,
      dto.episodeId,
    );
  }

  @Post('sessions/:id/heartbeat')
  async heartbeat(@CurrentUser() user: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.playbackService.heartbeat(id, user.id);
  }

  @Post('sessions/:id/end')
  async endSession(@CurrentUser() user: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.playbackService.endSession(id, user.id);
  }

  @Get('me/progress')
  async getProgress(@CurrentUser() user: UserRequest) {
    const progress = await this.prisma.watchProgress.findMany({
      where: { profile: { userId: user.id } },
      include: { title: true, episode: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return progress;
  }

  @Put('me/progress')
  async updateProgress(
    @CurrentUser() user: UserRequest,
    @Body() dto: UpdateProgressDto,
  ) {
    const profileId = dto.profileId || user.profiles[0];
    if (!profileId || !user.profiles.includes(profileId)) throw new ForbiddenException('Profile does not belong to user');
    const title = await this.prisma.title.findFirst({ where: { id: dto.titleId, tenantId: user.tenantId, state: 'PUBLISHED' }, select: { id: true } });
    if (!title) throw new NotFoundException('Title not found');
    if (dto.episodeId) {
      const episode = await this.prisma.episode.findFirst({ where: { id: dto.episodeId, titleId: dto.titleId, state: 'PUBLISHED' }, select: { id: true } });
      if (!episode) throw new NotFoundException('Episode not found');
      return this.prisma.watchProgress.upsert({
        where: { profileId_titleId_episodeId: { profileId, titleId: dto.titleId, episodeId: dto.episodeId } },
        create: { profileId, titleId: dto.titleId, episodeId: dto.episodeId, positionSec: dto.positionSec, durationSec: dto.durationSec ?? 0, completed: dto.completed ?? false },
        update: { positionSec: dto.positionSec, durationSec: dto.durationSec ?? 0, completed: dto.completed ?? false, updatedAt: new Date() },
      });
    }
    // Nullable columns do not conflict under the original composite unique index.
    // The partial unique index in migration 0003 provides an atomic movie upsert.
    const id = randomUUID();
    const rows = await this.prisma.$queryRaw<WatchProgress[]>`
      INSERT INTO "WatchProgress" ("id", "profileId", "titleId", "episodeId", "positionSec", "durationSec", "completed", "updatedAt")
      VALUES (${id}::uuid, ${profileId}::uuid, ${dto.titleId}::uuid, NULL, ${dto.positionSec}, ${dto.durationSec ?? 0}, ${dto.completed ?? false}, NOW())
      ON CONFLICT ("profileId", "titleId") WHERE "episodeId" IS NULL
      DO UPDATE SET "positionSec" = EXCLUDED."positionSec", "durationSec" = EXCLUDED."durationSec", "completed" = EXCLUDED."completed", "updatedAt" = NOW()
      RETURNING *`;
    return rows[0];
  }
}
