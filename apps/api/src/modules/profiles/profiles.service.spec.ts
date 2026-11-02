import argon2 = require('argon2');
import { publicProfileSelect } from '../../common/public-select';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesService } from './profiles.service';
import { PrismaService } from '../../prisma.service';

describe('ProfilesService', () => {
  let service: ProfilesService;

  const mockPrisma = {
    profile: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfilesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProfile', () => {
    it('should create a profile with hashed pin', async () => {
      jest.spyOn(argon2, 'hash').mockResolvedValue('hashed-pin');
      mockPrisma.profile.create.mockResolvedValue({
        id: 'profile-id',
        name: 'Kids Profile',
        isKid: true,
      });

      const result = await service.createProfile('user-id', {
        name: 'Kids Profile',
        isKid: true,
        pin: '1234',
      });

      expect(result).toHaveProperty('id', 'profile-id');
      expect(mockPrisma.profile.create).toHaveBeenCalledWith({
        select: publicProfileSelect,
        data: {
          userId: 'user-id',
          name: 'Kids Profile',
          isKid: true,
          maturityMax: 'PG-13',
          pinHash: 'hashed-pin',
        },
      });
    });
  });

  describe('getProfiles', () => {
    it('should return profiles for user', async () => {
      mockPrisma.profile.findMany.mockResolvedValue([
        { id: '1', name: 'Profile 1' },
        { id: '2', name: 'Profile 2' },
      ]);

      const result = await service.getProfiles('user-id');

      expect(result).toHaveLength(2);
      expect(mockPrisma.profile.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        select: publicProfileSelect,
      });
    });
  });

  describe('verifyPin', () => {
    it('should return true if profile has no pin', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'profile-id',
        pinHash: null,
      });

      const result = await service.verifyPin('profile-id', 'any-pin');
      expect(result).toBe(true);
    });

    it('should verify pin correctly', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'profile-id',
        pinHash: 'hashed-pin',
      });
      jest.spyOn(argon2, 'verify').mockResolvedValue(true);

      const result = await service.verifyPin('profile-id', '1234');
      expect(result).toBe(true);
    });
  });
});
