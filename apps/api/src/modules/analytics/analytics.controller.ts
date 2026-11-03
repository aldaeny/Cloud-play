import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma.service';
import { AdminJwtGuard, CurrentAdmin, AdminPrincipal } from '../../common';

@Controller('admin/analytics')
@UseGuards(AdminJwtGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('overview')
  async getOverview(@CurrentAdmin() admin: AdminPrincipal) {
    const tenantId = await this.getTenantId(admin.id);
    return this.analyticsService.getOverview(tenantId);
  }

  @Get('titles')
  async getTitlesStats(@CurrentAdmin() admin: AdminPrincipal, @Query('limit') limit?: string) {
    const tenantId = await this.getTenantId(admin.id);
    return this.analyticsService.getTitlesStats(tenantId, limit ? parseInt(limit) : 20);
  }

  @Get('playback')
  async getPlaybackStats(@CurrentAdmin() admin: AdminPrincipal, @Query('days') days?: string) {
    const tenantId = await this.getTenantId(admin.id);
    return this.analyticsService.getPlaybackStats(tenantId, days ? parseInt(days) : 7);
  }

  @Get('users')
  async getUserStats(@CurrentAdmin() admin: AdminPrincipal) {
    const tenantId = await this.getTenantId(admin.id);
    return this.analyticsService.getUserStats(tenantId);
  }

  @Get('devices')
  async getDeviceStats(@CurrentAdmin() admin: AdminPrincipal) {
    const tenantId = await this.getTenantId(admin.id);
    return this.analyticsService.getDeviceStats(tenantId);
  }

  private async getTenantId(staffId: string): Promise<string> {
    const staff = await this.prisma.staffUser.findUnique({ where: { id: staffId } });
    if (!staff) throw new Error('Staff user not found');
    return staff.tenantId;
  }
}
