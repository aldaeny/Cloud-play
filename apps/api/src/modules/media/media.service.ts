import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { StorageService } from '../../common/storage.service';
import { randomUUID } from 'crypto';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getUploadUrl(contentType: string, namespace?: string) {
    // Generate presigned URL for S3/MinIO upload via StorageService
    const extension = this.getExtension(contentType);
    const objectKey = `source/${namespace ? namespace + "/" : ""}${randomUUID()}${extension}`;

    const presigned = await this.storage.getPresignedUploadUrl(objectKey, contentType);

    return {
      uploadUrl: presigned.uploadUrl,
      objectKey: presigned.objectKey,
      contentType,
    };
  }

  async confirmUpload(objectKey: string, ownerType: string, ownerId: string, mediaType = 'video') {
    if (ownerType !== 'title' && ownerType !== 'episode') throw new BadRequestException('ownerType must be title or episode');
    // Persist the queued job together with the asset; the worker's dispatcher
    // retries enqueueing these durable records if Redis is unavailable.
    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerType,
        ownerId,
        ...(ownerType === 'title' ? { titleId: ownerId } : { episodeId: ownerId }),
        sourceKey: objectKey,
        sourceBucket: process.env.STORAGE_BUCKET || 'cloudplay-video',
        mediaType,
        status: 'uploaded',
        transcodeJobs: { create: { status: 'queued', progress: 0 } },
      },
      include: { transcodeJobs: true },
    });
    const job = asset.transcodeJobs[0];

    return { asset, job };
  }

  async getAssets(ownerId: string, ownerType?: string) {
    return this.prisma.mediaAsset.findMany({
      where: {
        ownerId,
        ...(ownerType ? { ownerType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { transcodeJobs: true },
    });
  }

  async getAsset(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: { transcodeJobs: true },
    });
    if (!asset) throw new NotFoundException('Media asset not found');
    return asset;
  }

  async deleteAsset(id: string) {
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { success: true };
  }

  async updateAssetStatus(id: string, status: string) {
    return this.prisma.mediaAsset.update({
      where: { id },
      data: { status },
    });
  }

  private getExtension(contentType: string): string {
    const map: Record<string, string> = {
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'audio/mpeg': '.mp3',
    };
    return map[contentType] || '.bin';
  }
}
