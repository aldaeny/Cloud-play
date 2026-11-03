import type { MediaAsset } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../../prisma.service';
import { StorageService } from '../../common/storage.service';

describe('MediaService', () => {
  let service: MediaService;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.STORAGE_ACCESS_KEY = 'S3RVER';
    process.env.STORAGE_SECRET_KEY = 'S3RVER';
    const moduleRef = await Test.createTestingModule({
      providers: [MediaService, PrismaService, StorageService],
    }).compile();

    service = moduleRef.get<MediaService>(MediaService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUploadUrl', () => {
    it('should generate upload URL with correct extension', async () => {
      const result = await service.getUploadUrl('video/mp4');
      expect(result.objectKey).toContain('source/');
      expect(result.objectKey).toContain('.mp4');
      expect(result.uploadUrl).toContain('http://localhost:9000');
      expect(result.uploadUrl).toContain('X-Amz-Signature');
    });

    it('should handle image content types', async () => {
      const result = await service.getUploadUrl('image/jpeg');
      expect(result.objectKey).toContain('.jpg');
    });
  });

  describe('confirmUpload', () => {
    it('should create media asset and transcode job', async () => {
      jest.spyOn(prisma.mediaAsset, 'create').mockResolvedValue({
        id: 'asset-1',
        sourceKey: 'source/test.mp4',
        status: 'uploaded',
        transcodeJobs: [{ id: 'job-1', status: 'queued' }],
      } as unknown as MediaAsset);

      const result = await service.confirmUpload('source/test.mp4', 'title', 'title-1', 'video');
      expect(result.asset.id).toBe('asset-1');
      expect(result.job.id).toBe('job-1');
    });
  });
});
