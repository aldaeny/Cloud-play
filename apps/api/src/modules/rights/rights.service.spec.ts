import { Test, TestingModule } from '@nestjs/testing';
import { RightsService } from './rights.service';
import { PrismaService } from '../../prisma.service';

describe('RightsService', () => {
  let service: RightsService;

  const mockPrisma = {
    rightsWindow: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RightsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<RightsService>(RightsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkRights', () => {
    it('should throw ForbiddenException if no rights windows found', async () => {
      mockPrisma.rightsWindow.findMany.mockResolvedValue([]);

      await expect(service.checkRights('title-id')).rejects.toThrow(
        'RIGHTS_OR_RATING',
      );
    });

    it('should return windows if rights exist', async () => {
      const windows = [{ id: '1', titleId: 'title-id' }];
      mockPrisma.rightsWindow.findMany.mockResolvedValue(windows);

      const result = await service.checkRights('title-id');

      expect(result).toEqual(windows);
    });

    it('should check territory matching', async () => {
      mockPrisma.rightsWindow.findMany.mockResolvedValue([
        { id: '1', territories: JSON.stringify(['US', 'CA']) },
      ]);

      const result = await service.checkRights('title-id', 'US');
      expect(result).toHaveLength(1);
    });
  });

  describe('getTerritories', () => {
    it('should return unique territories', async () => {
      mockPrisma.rightsWindow.findMany.mockResolvedValue([
        { territories: JSON.stringify(['US', 'CA']) },
        { territories: JSON.stringify(['US', 'UK']) },
      ]);

      const result = await service.getTerritories('title-id');

      expect(result).toEqual(expect.arrayContaining(['US', 'CA', 'UK']));
      expect(result).toHaveLength(3);
    });
  });
});
