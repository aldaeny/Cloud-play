import type { Title } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../../prisma.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CatalogService, PrismaService],
    }).compile();

    service = moduleRef.get<CatalogService>(CatalogService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return titles matching query', async () => {
      // Mock prisma.title.findMany
      jest.spyOn(prisma.title, 'findMany').mockResolvedValue([
        { id: '1', titleAr: 'فيلم', titleEn: 'Movie', kind: 'MOVIE', state: 'PUBLISHED' },
      ] as unknown as Title[]);

      const results = await service.search('tenant-1', 'فيلم');
      expect(results).toHaveLength(1);
      expect(prisma.title.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should filter by state PUBLISHED', async () => {
      jest.spyOn(prisma.title, 'findMany').mockResolvedValue([]);
      await service.search('tenant-1', undefined, 'action', 2024);
      expect(prisma.title.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ state: 'PUBLISHED' }),
        }),
      );
    });
  });

  describe('getTitleDetails', () => {
    it('should return title with seasons and episodes', async () => {
      const mockTitle = {
        id: '1',
        titleAr: 'فيلم',
        titleEn: 'Movie',
        state: 'PUBLISHED',
        seasons: [],
        rightsWindows: [],
        mediaAssets: [],
      };
      jest.spyOn(prisma.title, 'findFirst').mockResolvedValue(mockTitle as unknown as Title);
      jest.spyOn(prisma.title, 'update').mockResolvedValue({} as unknown as Title);

      const result = await service.getTitleDetails('tenant-1', '1');
      expect(result).toEqual(mockTitle);
    });
  });

  describe('getContinueWatching', () => {
    it('queries only published episodes and removes mismatched historical progress', async () => {
      const find = jest.spyOn(prisma.watchProgress, 'findMany').mockResolvedValue([
        { titleId: 'a', episodeId: null, episode: null },
        { titleId: 'a', episodeId: 'ep1', episode: { titleId: 'a' } },
        { titleId: 'a', episodeId: 'ep2', episode: { titleId: 'other' } },
      ] as never);
      const rows = await service.getContinueWatching('tenant-1', 'profile-1');
      expect(rows).toHaveLength(2);
      expect(find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ profileId: 'profile-1', title: { tenantId: 'tenant-1', state: 'PUBLISHED' },
          OR: [{ episodeId: null }, { episode: { is: { state: 'PUBLISHED', title: { tenantId: 'tenant-1', state: 'PUBLISHED' } } } }] }),
      }));
    });
  });

  describe('getTrending', () => {
    it('should return trending titles ordered by views', async () => {
      jest.spyOn(prisma.title, 'findMany').mockResolvedValue([
        { id: '1', titleEn: 'Top Movie', viewsCount: 1000 },
      ] as unknown as Title[]);

      const result = await service.getTrending('tenant-1');
      expect(result).toHaveLength(1);
      expect(prisma.title.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ state: 'PUBLISHED' }),
          orderBy: { viewsCount: 'desc' },
        }),
      );
    });
  });
});
