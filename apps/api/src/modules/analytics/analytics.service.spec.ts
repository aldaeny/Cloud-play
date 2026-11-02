import { Test } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AnalyticsService, PrismaService],
    }).compile();

    service = moduleRef.get<AnalyticsService>(AnalyticsService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return overview stats', async () => {
      jest.spyOn(prisma.title, 'count').mockResolvedValue(10);
      jest.spyOn(prisma.appUser, 'count').mockResolvedValue(50);
      jest.spyOn(prisma.subscription, 'count').mockResolvedValue(20);
      jest.spyOn(prisma.title, 'aggregate').mockResolvedValue({
        _sum: { viewsCount: 5000 },
      } as unknown as Awaited<ReturnType<typeof prisma.title.aggregate>>);

      const result = await service.getOverview('tenant-1');
      expect(result.titles).toBe(10);
      expect(result.users).toBe(50);
      expect(result.activeSubscriptions).toBe(20);
      expect(result.totalViews).toBe(5000);
    });
  });

  describe('getUserStats', () => {
    it('should return user stats with conversion rate', async () => {
      jest.spyOn(prisma.appUser, 'count')
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(90) // active
        .mockResolvedValueOnce(30); // paying

      const result = await service.getUserStats('tenant-1');
      expect(result.totalUsers).toBe(100);
      expect(result.activeUsers).toBe(90);
      expect(result.payingUsers).toBe(30);
      expect(result.conversionRate).toBe('30.00');
    });
  });
});
