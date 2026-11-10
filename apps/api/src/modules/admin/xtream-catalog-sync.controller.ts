import { XtreamSyncRunner } from './xtream-sync-runner.service';
import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AdminJwtGuard, CurrentAdmin, type AdminPrincipal, RequirePermissions } from '../../common';
import { XtreamCatalogSyncService } from './xtream-catalog-sync.service';

@Controller('admin/xtream-servers/:id/catalog-sync')
@UseGuards(AdminJwtGuard)
@RequirePermissions('xtream:manage')
export class XtreamCatalogSyncController {
  constructor(private readonly sync: XtreamCatalogSyncService, private readonly runner: XtreamSyncRunner) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  status(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.sync.status(admin.tenantId, id);
  }

  @Post('pull')
  @Header('Cache-Control', 'no-store')
  pull(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { authorizationConfirmed?: boolean }) {
    return this.runner.run(admin.tenantId, id, body?.authorizationConfirmed === true);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  importExport(@CurrentAdmin() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { catalog?: unknown; authorizationConfirmed?: boolean }) {
    return this.sync.importExport(admin.tenantId, id, body?.catalog, body?.authorizationConfirmed === true);
  }
}
