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
      await expect(service.checkRights('title-id', 'GB')).rejects.toThrow('RIGHTS_OR_RATING');
    });

    it.each(['["US",', '"RUS"', '["RUS"]', '{"country":"US"}', '["US",42]', 'RUS'])(
      'rejects malformed or substring-only territory data: %s', async territories => {
        mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1', territories }]);
        await expect(service.checkRights('title-id', 'US')).rejects.toThrow('RIGHTS_OR_RATING');
      });

    it('retains exact legacy single-code matches', async () => {
      mockPrisma.rightsWindow.findMany.mockResolvedValue([{ id: '1', territories: 'US' }]);
      await expect(service.checkRights('title-id', 'US')).resolves.toHaveLength(1);
      await expect(service.checkRights('title-id', 'U')).rejects.toThrow('RIGHTS_OR_RATING');
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
