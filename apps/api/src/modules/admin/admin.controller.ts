import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma.service';
import { AdminJwtGuard, RequirePermissions, CurrentAdmin, AdminPrincipal } from '../../common';

@Controller('admin')
@UseGuards(AdminJwtGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  // ── User Management ──────────────────────────────────────
  @Get('users')
  async getUsers(@CurrentAdmin() admin: AdminPrincipal, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.getUsers(tenantId, page ? parseInt(page) : 1, pageSize ? parseInt(pageSize) : 20);
  }

  @Get('users/:id')
  async getUser(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.getUser(tenantId, id);
  }

  @Put('users/:id/status')
  @RequirePermissions('users:manage')
  async updateUserStatus(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.updateUserStatus(tenantId, id, status);
  }

  // ── Device Management ───────────────────────────────────
  @Get('devices')
  async getDevices(@CurrentAdmin() admin: AdminPrincipal) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.getDevices(tenantId);
  }

  @Delete('devices/:id/revoke')
  @RequirePermissions('devices:manage')
  async revokeDevice(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.revokeDevice(tenantId, id);
  }

  // ── Staff Management ─────────────────────────────────────
  @Get('staff')
  async getStaff(@CurrentAdmin() admin: AdminPrincipal) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.getStaffUsers(tenantId);
  }

  @Post('staff')
  @RequirePermissions('staff:manage')
  async createStaff(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: { email: string; password: string; roleId: string },
  ) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.createStaffUser(tenantId, body.email, body.password, body.roleId);
  }

  // ── Roles ───────────────────────────────────────────────
  @Get('roles')
  async getRoles(@CurrentAdmin() admin: AdminPrincipal) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.getRoles(tenantId);
  }

  @Post('roles')
  @RequirePermissions('staff:manage')
  async createRole(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: { name: string; permissions: string[] },
  ) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.createRole(tenantId, body.name, body.permissions);
  }

  // ── Audit Logs ───────────────────────────────────────────
  @Get('audit-logs')
  async getAuditLogs(@CurrentAdmin() admin: AdminPrincipal, @Query('limit') limit?: string) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.getAuditLogs(tenantId, limit ? parseInt(limit) : 50);
  }

  // ── Transcode Jobs ──────────────────────────────────────
  @Get('transcode-jobs')
  async getTranscodeJobs(@CurrentAdmin() admin: AdminPrincipal) {
    const tenantId = await this.getTenantId(admin.id);
    return this.adminService.getTranscodeJobs(tenantId);
  }

  // ── Dashboard Overview ───────────────────────────────────
  @Get('dashboard')
  async getDashboard(@CurrentAdmin() admin: AdminPrincipal) {
    const tenantId = await this.getTenantId(admin.id);
    const [titles, users, published, subs, jobs] = await Promise.all([
      this.prisma.title.count({ where: { tenantId } }),
      this.prisma.appUser.count({ where: { tenantId } }),
      this.prisma.title.count({ where: { tenantId, state: 'PUBLISHED' } }),
      this.prisma.subscription.count({ where: { plan: { tenantId }, status: 'ACTIVE' } }),
      this.prisma.transcodeJob.count({ where: { mediaAsset: { title: { tenantId } } } }),
    ]);

    return {
      totalTitles: titles,
      publishedTitles: published,
      totalUsers: users,
      activeSubscriptions: subs,
      transcodeJobs: jobs,
    };
  }

  private async getTenantId(staffId: string): Promise<string> {
    const staff = await this.prisma.staffUser.findUnique({ where: { id: staffId } });
    if (!staff) throw new Error('Staff user not found');
    return staff.tenantId;
  }
}
