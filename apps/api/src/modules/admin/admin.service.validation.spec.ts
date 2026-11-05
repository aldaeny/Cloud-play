import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma.service';

/**
 * Focused, runnable coverage for the Phase-6 admin hardening fixes.
 * The legacy admin.service.spec.ts instantiates a real PrismaService and imports
 * generated model types, so it cannot run where the Prisma engine is unavailable.
 * This suite mocks Prisma (like entitlement.service.spec.ts) and does not import
 * generated types, so it verifies the validation logic in any environment.
 */
describe('AdminService validation (Phase 6)', () => {
  let service: AdminService;

  const mockPrisma = {
    appUser: { findFirst: jest.fn(), update: jest.fn() },
    staffUser: { findUnique: jest.fn(), create: jest.fn() },
    role: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AdminService>(AdminService);
  });

  describe('updateUserStatus', () => {
    it.each(['active', 'suspended', 'disabled'])('accepts the valid status "%s"', async (status) => {
      mockPrisma.appUser.findFirst.mockResolvedValue({ id: 'u1' });
      mockPrisma.appUser.update.mockResolvedValue({ id: 'u1', status });

      const result = await service.updateUserStatus('t1', 'u1', status);

      expect(result.status).toBe(status);
      expect(mockPrisma.appUser.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status } }),
      );
    });

    it.each(['', 'Active', 'ACTIVE', 'banned', 'undefined-state'])('rejects the invalid status "%s" with 400', async (status) => {
      await expect(service.updateUserStatus('t1', 'u1', status)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.appUser.update).not.toHaveBeenCalled();
    });
  });

  describe('createStaffUser', () => {
    it('returns 409 Conflict (not 404) when the email already exists', async () => {
      mockPrisma.staffUser.findUnique.mockResolvedValue({ id: 's1', email: 'a@b.c' });

      await expect(service.createStaffUser('t1', 'a@b.c', 'password123', 'r1')).rejects.toThrow(ConflictException);
      expect(mockPrisma.staffUser.create).not.toHaveBeenCalled();
    });
  });
});
