import type { Title } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { EditorialService } from './editorial.service';
import { PrismaService } from '../../prisma.service';

describe('EditorialService', () => {
  let service: EditorialService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [EditorialService, PrismaService],
    }).compile();

    service = moduleRef.get<EditorialService>(EditorialService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTitle', () => {
    it('should create title with genres', async () => {
      jest.spyOn(prisma.title, 'create').mockResolvedValue({
        id: '1',
        titleEn: 'Test Movie',
        state: 'DRAFT',
        genres: ['action', 'drama'],
      } as unknown as Title);

      const result = await service.createTitle({
        tenantId: 'tenant-1',
        kind: 'MOVIE',
        titleAr: 'فيلم',
        titleEn: 'Test Movie',
        maturityRating: 'PG-13',
        genres: ['action', 'drama'],
      });
      expect(result.id).toBe('1');
      expect(result.genres).toEqual(['action', 'drama']);
    });
  });

  describe('updateTitle', () => {
    it('should update title state', async () => {
      jest.spyOn(prisma.title, 'findFirst').mockResolvedValue({ id: '1' } as unknown as Title);
      jest.spyOn(prisma.title, 'update').mockResolvedValue({
        id: '1',
        state: 'PUBLISHED',
      } as unknown as Title);

      const result = await service.updateTitle('tenant-1', '1', { state: 'PUBLISHED' });
      expect(result.state).toBe('PUBLISHED');
    });
  });
});
