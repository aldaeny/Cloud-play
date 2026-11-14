import { publicProfileSelect } from '../../common/public-select';
import { Prisma } from '@prisma/client';
import { jwtTtlSeconds } from '../../common/token-ttl';
import { Injectable, Logger, ConflictException, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { RegisterDto, LoginDto, LoginPhoneDto, IdentityUpdateDto } from './identity.dto';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private requireTokenSecrets() {
    // Retain explicit legacy development compatibility, never operate a second
    // end-user credential issuer beside the selected Supabase authority.
    if ((process.env.API_END_USER_AUTHORITY || 'legacy') !== 'legacy') {
      throw new ServiceUnavailableException('END_USER_AUTH_MANAGED_BY_SUPABASE');
    }
    const access = process.env.JWT_ACCESS_SECRET;
    const refresh = process.env.JWT_REFRESH_SECRET;
    if (!access || !refresh || access === refresh) throw new ServiceUnavailableException('User authentication is not configured securely');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async storeRefreshToken(userId: string, refreshToken: string, deviceId?: string) {
    const tokenHash = this.hashToken(refreshToken);
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
      algorithms: ['HS256'],
    });
    const expiresAt = new Date(payload.exp * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceId,
        expiresAt,
      },
    });
  }

  async register(dto: RegisterDto) {
    this.requireTokenSecrets();
    const existing = await this.prisma.appUser.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    const tenantId = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';

    const user = await this.prisma.appUser.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash: hashedPassword,
        tenantId,
        profiles: {
          create: {
            id: dto.profileId,
            name: dto.name,
            isKid: false,
            maturityMax: 'PG-13',
          },
        },
      },
      include: {
        profiles: { select: publicProfileSelect },
      },
    });

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      profiles: user.profiles.map(p => p.id),
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: jwtTtlSeconds('JWT_ACCESS_TTL', 900),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: jwtTtlSeconds('JWT_REFRESH_TTL', 604800),
    });

    await this.storeRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        profiles: user.profiles,
      },
      accessToken,
      refreshToken,
    };
  }

  async adminLogin(dto: LoginDto) {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) throw new ServiceUnavailableException('Admin authentication is not configured');
    const staff = await this.prisma.staffUser.findUnique({ where: { email: dto.email }, include: { role: true } });
    if (!staff || staff.role.tenantId !== staff.tenantId || !(await argon2.verify(staff.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessToken = await this.jwtService.signAsync({ sub: staff.id, tokenType: 'admin' }, { secret, expiresIn: 900, algorithm: 'HS256' });
    return { accessToken, expiresIn: 900, staff: { id: staff.id, tenantId: staff.tenantId, roleId: staff.roleId } };
  }

  async login(dto: LoginDto, deviceId?: string) {
    this.requireTokenSecrets();
    const user = await this.prisma.appUser.findUnique({
      where: { email: dto.email },
      include: { profiles: { select: publicProfileSelect } },
    });

    if (!user || user.status !== 'active' || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      profiles: user.profiles.map(p => p.id),
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: jwtTtlSeconds('JWT_ACCESS_TTL', 900),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: jwtTtlSeconds('JWT_REFRESH_TTL', 604800),
    });

    await this.storeRefreshToken(user.id, refreshToken, deviceId);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        profiles: user.profiles,
      },
      accessToken,
      refreshToken,
    };
  }

  async loginWithPhone(dto: LoginPhoneDto, deviceId?: string) {
    this.requireTokenSecrets();
    const user = await this.prisma.appUser.findFirst({
      where: { phone: dto.phone },
      include: { profiles: { select: publicProfileSelect } },
    });

    if (!user || user.status !== 'active' || !user.passwordHash) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      profiles: user.profiles.map(p => p.id),
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: jwtTtlSeconds('JWT_ACCESS_TTL', 900),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: jwtTtlSeconds('JWT_REFRESH_TTL', 604800),
    });

    await this.storeRefreshToken(user.id, refreshToken, deviceId);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        profiles: user.profiles,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string, deviceId?: string) {
    this.requireTokenSecrets();
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
        algorithms: ['HS256'],
      });

      // Check if token is revoked in database
      const tokenHash = this.hashToken(refreshToken);
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!storedToken || storedToken.revokedAt) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const user = await this.prisma.appUser.findUnique({
        where: { id: payload.sub },
        include: { profiles: { select: publicProfileSelect } },
      });

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Revoke the old token
      await this.prisma.refreshToken.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });

      const newPayload = {
        sub: user.id,
        tenantId: user.tenantId,
        profiles: user.profiles.map(p => p.id),
      };

      const newAccessToken = await this.jwtService.signAsync(newPayload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: jwtTtlSeconds('JWT_ACCESS_TTL', 900),
      });

      const newRefreshToken = await this.jwtService.signAsync(newPayload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: jwtTtlSeconds('JWT_REFRESH_TTL', 604800),
      });

      // Store new refresh token, linking it to the old one
      await this.storeRefreshToken(user.id, newRefreshToken, deviceId);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken?: string) {
    this.requireTokenSecrets();
    // If no refresh token provided, treat as successful logout (idempotent)
    if (!refreshToken) {
      return { success: true };
    }
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
        algorithms: ['HS256'],
      });

      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });

      return { success: true };
    } catch {
      // Even if token is invalid/expired, treat as successful logout
      return { success: true };
    }
  }

  async revokeAllUserTokens(userId: string) {
    this.requireTokenSecrets();
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true, message: 'All user tokens revoked' };
  }

  async updateIdentity(userId: string, dto: IdentityUpdateDto) {
    if ((dto.email || dto.password) && (process.env.API_END_USER_AUTHORITY || 'legacy') !== 'legacy') {
      throw new ServiceUnavailableException('END_USER_AUTH_MANAGED_BY_SUPABASE');
    }
    const updateData: Prisma.AppUserUpdateInput = {};
    if (dto.email) updateData.email = dto.email;
    if (dto.name) {
      // Update profile name since AppUser doesn't have a name field
      await this.prisma.profile.updateMany({
        where: { userId },
        data: { name: dto.name },
      });
    }
    if (dto.password) {
      updateData.passwordHash = await argon2.hash(dto.password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
    }

    const user = await this.prisma.appUser.update({
      where: { id: userId },
      data: updateData,
      include: { profiles: { select: publicProfileSelect } },
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      profiles: user.profiles,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, email: true, phone: true, emailVerifiedAt: true, status: true, createdAt: true, profiles: { select: publicProfileSelect }, subscriptions: true, devices: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
