import argon2 = require('argon2');
import { Test, TestingModule } from '@nestjs/testing';
import { IdentityService } from './identity.service';
import { PrismaService } from '../../prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('IdentityService', () => {
  let service: IdentityService;

  const mockPrisma = {
    appUser: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwt = {
    signAsync: jest.fn().mockResolvedValue('mock-token'),
    verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-id' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue({ email: 'test@test.com' });

      await expect(
        service.register({
          email: 'test@test.com',
          password: 'password123',
          name: 'Test User',
          phone: '+1234567890',
        }),
      ).rejects.toThrow('Email is already registered');
    });

    it('should create user and return tokens', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(null);
      mockPrisma.appUser.create.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        phone: '+1234567890',
        passwordHash: 'hashed-password',
        tenantId: '00000000-0000-0000-0000-000000000000',
        profiles: [{ id: 'profile-id', name: 'Test User' }],
      });

      const result = await service.register({
        email: 'test@test.com',
        password: 'password123',
        name: 'Test User',
        phone: '+1234567890',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should return tokens for valid credentials', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$hash',
        tenantId: '00000000-0000-0000-0000-000000000000',
        profiles: [{ id: 'profile-id' }],
      });

      jest.spyOn(argon2, 'verify').mockResolvedValue(true);

      const result = await service.login({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      mockJwt.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });

  describe('logout', () => {
    it('does not falsely claim server-side token revocation', async () => {
      await expect(service.logout()).rejects.toThrow('Server-side token revocation is not implemented');
    });
  });
});
