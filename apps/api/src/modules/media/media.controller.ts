import {
  Controller, Get, Post, Delete, Param, Body, Query, UseGuards,
  BadRequestException, NotFoundException, ServiceUnavailableException, ParseUUIDPipe,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { StorageService } from '../../common/storage.service';
import { PrismaService } from '../../prisma.service';
import { AdminJwtGuard, RequirePermissions, CurrentAdmin } from '../../common';
import type { AdminPrincipal } from '../../common/admin-jwt.guard';

/** Video assets belong to catalog entries, not end-user profiles. */
@Controller('media')
@UseGuards(AdminJwtGuard)
@RequirePermissions('titles:edit')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Post('upload-url')
  async getUploadUrl(@CurrentAdmin() admin: AdminPrincipal, @Body('contentType') contentType: string) {
    if (!['video/mp4', 'video/quicktime'].includes(contentType)) throw new BadRequestException('Unsupported video content type');
    return this.mediaService.getUploadUrl(contentType, `${admin.tenantId}/${admin.id}`);
  }

  @Post('confirm')
  async confirmUpload(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: { objectKey: string; ownerType: string; ownerId: string; mediaType?: string },
  ) {
    const prefix = `source/${admin.tenantId}/${admin.id}/`;
    if (typeof body.objectKey !== 'string' || !body.objectKey.startsWith(prefix) ||
        !/^[0-9a-f-]{36}\.(mp4|mov)$/i.test(body.objectKey.slice(prefix.length))) {
      throw new BadRequestException('Invalid upload object key');
    }
    if (body.mediaType && body.mediaType !== 'video') throw new BadRequestException('Only video uploads are supported');
    await this.assertOwner(admin.tenantId, body.ownerType, body.ownerId);
    try {
      if (!(await this.storage.objectExists(body.objectKey))) throw new BadRequestException('Uploaded object not found');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('Storage unavailable');
    }
    return this.mediaService.confirmUpload(body.objectKey, body.ownerType, body.ownerId, 'video');
  }

  @Get('assets')
  async getAssets(@CurrentAdmin() admin: AdminPrincipal, @Query('ownerId') ownerId?: string) {
    if (!ownerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId)) throw new BadRequestException('Valid ownerId is required');
    return this.prisma.mediaAsset.findMany({
      where: { ownerId, OR: [{ title: { tenantId: admin.tenantId } }, { episode: { title: { tenantId: admin.tenantId } } }] },
      include: { transcodeJobs: true }, orderBy: { createdAt: 'desc' },
    });
  }

  @Get('assets/:id')
  async getAsset(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.findAsset(admin.tenantId, id);
  }

  @Delete('assets/:id')
  async deleteAsset(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    await this.findAsset(admin.tenantId, id);
    return this.mediaService.deleteAsset(id);
  }

  private async assertOwner(tenantId: string, ownerType: string, ownerId: string): Promise<void> {
    if (typeof ownerId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId)) {
      throw new BadRequestException('Invalid owner ID');
    }
    if (ownerType !== 'title' && ownerType !== 'episode') throw new BadRequestException('Invalid owner type');
    const owner = ownerType === 'title'
      ? await this.prisma.title.findFirst({ where: { id: ownerId, tenantId }, select: { id: true } })
      : await this.prisma.episode.findFirst({ where: { id: ownerId, title: { tenantId } }, select: { id: true } });
    if (!owner) throw new NotFoundException('Owner not found');
  }

  private async findAsset(tenantId: string, id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, OR: [{ title: { tenantId } }, { episode: { title: { tenantId } } }] },
      include: { transcodeJobs: true },
    });
    if (!asset) throw new NotFoundException('Media asset not found');
    return asset;
  }
}

@Controller('admin/media')
@UseGuards(AdminJwtGuard)
@RequirePermissions('titles:edit')
export class AdminMediaController {
  constructor(private readonly mediaService: MediaService, private readonly prisma: PrismaService) {}

  @Get('assets')
  async listAllAssets(@CurrentAdmin() admin: AdminPrincipal, @Query('status') status?: string) {
    return this.prisma.mediaAsset.findMany({
      where: { ...(status ? { status } : {}), OR: [{ title: { tenantId: admin.tenantId } }, { episode: { title: { tenantId: admin.tenantId } } }] },
      orderBy: { createdAt: 'desc' }, include: { transcodeJobs: true }, take: 100,
    });
  }

  @Post('assets/:id/status')
  async updateAssetStatus(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body('status') status: string) {
    if (!['uploaded', 'queued', 'FAILED'].includes(status)) throw new BadRequestException('Invalid manual status');
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, OR: [{ title: { tenantId: admin.tenantId } }, { episode: { title: { tenantId: admin.tenantId } } }] }, select: { id: true },
    });
    if (!asset) throw new NotFoundException('Media asset not found');
    return this.mediaService.updateAssetStatus(id, status);
  }
}
