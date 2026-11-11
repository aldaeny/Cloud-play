import { Controller, Get, Put, Post, Body, UseGuards, Param, ParseUUIDPipe, BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminJwtGuard, RequirePermissions, CurrentAdmin } from '../../common';
import type { AdminPrincipal } from '../../common/admin-jwt.guard';
import { TenantSettingsService } from './tenant-settings.service';
import { PrismaService } from '../../prisma.service';

@Controller('admin/tenant-settings')
@UseGuards(AdminJwtGuard)
export class TenantSettingsController {
  constructor(private readonly settings: TenantSettingsService, private readonly prisma: PrismaService) {}

  @Get('branding')
  @RequirePermissions('settings:manage')
  getBranding(@CurrentAdmin() admin: AdminPrincipal) { return this.settings.getBranding(admin.tenantId); }

  @Put('branding')
  @RequirePermissions('settings:manage')
  saveBranding(@CurrentAdmin() admin: AdminPrincipal, @Body() input: unknown) { return this.settings.saveBranding(admin.tenantId, admin.id, input); }

  @Post('internal-plans')
  @RequirePermissions('licenses:manage')
  install(@CurrentAdmin() admin: AdminPrincipal) { return this.settings.installInternalPlans(admin.tenantId, admin.id); }

  @Get('licenses')
  @RequirePermissions('licenses:manage')
  list(@CurrentAdmin() admin: AdminPrincipal) {
    return this.prisma.subscription.findMany({ where: { user: { tenantId: admin.tenantId }, plan: { tenantId: admin.tenantId }, provider: 'internal-manual' }, include: { plan: true }, take: 100, orderBy: { createdAt: 'desc' } });
  }

  @Post('licenses')
  @RequirePermissions('licenses:manage')
  async activate(@CurrentAdmin() admin: AdminPrincipal, @Body() input: { userId?: string; planId?: string; expiresAt?: string }) {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.userId || '') || !/^[0-9a-f-]{36}$/i.test(input.planId || '') || typeof input.expiresAt !== 'string') throw new BadRequestException('User, plan and expiry required');
    const expiry = new Date(input.expiresAt);
    if (!Number.isFinite(expiry.getTime()) || expiry <= new Date() || expiry.getTime() > Date.now() + 366 * 86400000) throw new BadRequestException('Expiry must be within one year');
    return this.prisma.$transaction(async tx => {
      const user = await tx.appUser.findFirst({ where: { id: input.userId, tenantId: admin.tenantId, status: 'active' }, select: { id: true } });
      const plan = await tx.plan.findFirst({ where: { id: input.planId, tenantId: admin.tenantId, active: true, interval: 'manual', priceCents: 0, code: { in: ['internal-starter', 'internal-professional', 'internal-business'] } }, select: { id: true } });
      if (!user || !plan) throw new NotFoundException('User or internal plan not found');
      const license = await tx.subscription.create({ data: { userId: user.id, planId: plan.id, provider: 'internal-manual', status: 'ACTIVE', currentPeriodEnd: expiry } });
      await tx.auditLog.create({ data: { tenantId: admin.tenantId, actorId: admin.id, action: 'internal-license.activated', entity: 'Subscription', entityId: license.id, diff: { financial: false } } });
      return { financial: false, license };
    });
  }

  @Post('licenses/:id/revoke')
  @RequirePermissions('licenses:manage')
  revoke(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.$transaction(async tx => {
      const changed = await tx.subscription.updateMany({ where: { id, provider: 'internal-manual', user: { tenantId: admin.tenantId }, plan: { tenantId: admin.tenantId } }, data: { status: 'CANCELED' } });
      if (!changed.count) throw new NotFoundException('License not found');
      await tx.auditLog.create({ data: { tenantId: admin.tenantId, actorId: admin.id, action: 'internal-license.revoked', entity: 'Subscription', entityId: id, diff: { financial: false } } });
      return { financial: false, revoked: true };
    });
  }
}
