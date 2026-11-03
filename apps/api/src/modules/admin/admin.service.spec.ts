import type { AppUser } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AdminService, PrismaService],
    }).compile();

    service = moduleRef.get<AdminService>(AdminService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUsers', () => {
    it('should paginate users', async () => {
      jest.spyOn(prisma.appUser, 'findMany').mockResolvedValue([
        { id: '1', email: 'test@test.com' },
      ] as unknown as AppUser[]);
      jest.spyOn(prisma.appUser, 'count').mockResolvedValue(1);

      const result = await service.getUsers('tenant-1', 1, 20);
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      jest.spyOn(prisma.appUser, 'findFirst').mockResolvedValue({ id: '1' } as unknown as AppUser);
      jest.spyOn(prisma.appUser, 'update').mockResolvedValue({
        id: '1',
        status: 'suspended',
      } as unknown as AppUser);

      const result = await service.updateUserStatus('tenant-1', '1', 'suspended');
      expect(result.status).toBe('suspended');
    });
  });
});
