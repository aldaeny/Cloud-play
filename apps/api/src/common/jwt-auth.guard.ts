import { requireOrganization } from './organization-license';
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  CanActivate,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import type { Request } from 'express';
import type { UserRequest } from './permissions.decorator';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  profiles: string[];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Optional() private readonly supabase?: SupabaseAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authority = process.env.API_END_USER_AUTHORITY || 'legacy';
    if (authority === 'supabase') {
      if (!this.supabase) throw new ServiceUnavailableException('AUTH_NOT_CONFIGURED');
      // Never fall back to a legacy JWT when Supabase denies or is unavailable.
      return this.supabase.canActivate(context);
    }
    if (authority !== 'legacy') throw new ServiceUnavailableException('AUTH_NOT_CONFIGURED');

    const request = context.switchToHttp().getRequest<Request & { user?: UserRequest }>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    if (!process.env.JWT_ACCESS_SECRET) throw new UnauthorizedException('Authentication is not configured');
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      });

      if (typeof payload.sub !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)) {
        throw new UnauthorizedException('Invalid identity');
      }

      // Verify user still exists and is active
      const user = await this.prisma.appUser.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true, tenantId: true, profiles: { select: { id: true } } },
      });

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('User not found or inactive');
      }

      await requireOrganization(this.prisma, user.tenantId);
      // Attach user to request for downstream handlers
      request.user = {
        id: payload.sub,
        tenantId: user.tenantId,
        profiles: user.profiles.map(profile => profile.id),
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    // Check cookies
    const cookieToken: unknown = request.cookies?.accessToken;
    if (typeof cookieToken === 'string') return cookieToken;
    return undefined;
  }
}
