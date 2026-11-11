import { ExternalReportsService } from './external-reports.service';
import { ExternalMonitorService } from './external-monitor.service';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard, AdminPrincipal, CurrentAdmin, RequirePermissions } from '../../common';
import { ExternalServersService } from './external-servers.service';

@Controller('admin/external-servers')
@UseGuards(AdminJwtGuard)
@RequirePermissions('xtream:manage')
export class ExternalServersController {
  constructor(private readonly servers: ExternalServersService, private readonly monitor: ExternalMonitorService, private readonly reports: ExternalReportsService) {}
  @Get() list(@CurrentAdmin() a: AdminPrincipal, @Query('cursor') cursor?: string) { return this.servers.list(a.tenantId, cursor); }
  @Post() create(@CurrentAdmin() a: AdminPrincipal, @Body() body: unknown) { return this.servers.save(a.tenantId, a.id, body); }
  @Put(':id') update(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Body() body: unknown) { return this.servers.save(a.tenantId, a.id, body, id); }
  @Delete(':id') remove(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string) { return this.servers.remove(a.tenantId, a.id, id); }
  @Get('licenses') licenses(@CurrentAdmin() a: AdminPrincipal) { return this.servers.licenses(a.tenantId); }
  @Post('licenses') createLicense(@CurrentAdmin() a: AdminPrincipal, @Body() body: unknown) { return this.servers.createLicense(a.tenantId, a.id, body); }
  @Post('licenses/:id/review') @RequirePermissions('xtream:manage', 'rights:manage')
  review(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Body() body: unknown) { return this.servers.reviewLicense(a.tenantId, a.id, id, body); }
  @Post(':id/license/:licenseId') assign(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Param('licenseId') licenseId: string) { return this.servers.assignLicense(a.tenantId, a.id, id, licenseId); }
  @Post(':id/check') check(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Body() body: unknown) { return this.servers.check(a.tenantId, a.id, id, body); }
  @Get(':id/history') history(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string) { return this.servers.history(a.tenantId, id); }
  @Get(':id/eligibility') eligibility(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Query('platform') platform: string, @Query('country') country: string) { return this.servers.eligibility(a.tenantId, id, platform, country); }
  @Post('licenses/:id/documents')
  uploadDocument(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Body() body: unknown) { return this.servers.uploadDocument(a.tenantId, a.id, id, body); }
  @Get('licenses/:id/documents')
  documents(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string) { return this.servers.documents(a.tenantId, id); }
  @Get('documents/:id') @RequirePermissions('xtream:manage', 'rights:manage')
  readDocument(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string) { return this.servers.readDocument(a.tenantId, a.id, id); }
  @Post('documents/:id/scan') @RequirePermissions('xtream:manage','rights:manage')
  scanDocument(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string) { return this.servers.rescanDocument(a.tenantId,a.id,id); }
  @Delete('documents/:id') @RequirePermissions('xtream:manage','rights:manage')
  deleteDocument(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string) { return this.servers.deleteDocument(a.tenantId,a.id,id); }
  @Post(':id/schedule') schedule(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Body() body: unknown) { return this.monitor.configure(a.tenantId, a.id, id, body); }
  @Get('reports/:period') report(@CurrentAdmin() a: AdminPrincipal, @Param('period') period: string) { return this.monitor.report(a.tenantId, period); }
  @Get('report-deliveries') deliveries(@CurrentAdmin() a: AdminPrincipal) { return this.reports.list(a.tenantId); }
  @Post('report-schedule') @RequirePermissions('xtream:manage','external:reports')
  reportSchedule(@CurrentAdmin() a: AdminPrincipal, @Body() body: unknown) { return this.reports.configure(a.tenantId,a.id,body); }
  @Get('audit') audits(@CurrentAdmin() a: AdminPrincipal) { return this.servers.audits(a.tenantId); }
}
