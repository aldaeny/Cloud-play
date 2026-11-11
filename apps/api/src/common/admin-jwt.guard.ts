import { requireOrganization } from './organization-license';
import { Injectable, ExecutionContext, UnauthorizedException, ForbiddenException, CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';
import type { Request } from 'express';

export interface AdminPrincipal { id: string; tenantId: string; roleId: string; permissions: string[] }

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { admin?: AdminPrincipal }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('No admin authentication token provided');
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) throw new UnauthorizedException('Admin authentication is not configured');
    let payload: { sub: string; tokenType?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; tokenType?: string }>(header.slice(7), { secret, algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
    if (typeof payload.sub !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub) || payload.tokenType !== 'admin') throw new UnauthorizedException('Invalid admin token');
    const staff = await this.prisma.staffUser.findUnique({ where: { id: payload.sub }, include: { role: true } });
    if (!staff || staff.role.tenantId !== staff.tenantId) throw new UnauthorizedException('Invalid admin account');
    await requireOrganization(this.prisma, staff.tenantId);
    let permissions: string[] = [];
    try {
      const value: unknown = JSON.parse(staff.role.permissions);
      if (Array.isArray(value) && value.every((v: unknown) => typeof v === 'string')) permissions = value as string[];
    } catch {
      permissions = staff.role.permissions.split(',').map(p => p.trim()).filter(Boolean);
    }
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) || [];
    if (!required.every(permission => permissions.includes(permission))) throw new ForbiddenException('Insufficient permissions');
    request.admin = { id: staff.id, tenantId: staff.tenantId, roleId: staff.roleId, permissions };
    return true;
  }
}
