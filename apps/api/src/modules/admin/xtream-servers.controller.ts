import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminJwtGuard, CurrentAdmin, AdminPrincipal, RequirePermissions } from '../../common';
import { XtreamServersService } from './xtream-servers.service';

@Controller('admin/xtream-servers')
@UseGuards(AdminJwtGuard)
@RequirePermissions('xtream:manage')
export class XtreamServersController {
  constructor(private readonly servers: XtreamServersService) {}

  @Get()
  list(@CurrentAdmin() admin: AdminPrincipal) {
    return this.servers.list(admin.tenantId);
  }

  @Post()
  create(@CurrentAdmin() admin: AdminPrincipal, @Body() body: {
    name: string; baseUrl: string; username: string; password: string;
  }) {
    return this.servers.create(admin.tenantId, body);
  }

  @Patch(':id')
  update(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() body: {
    name?: string; baseUrl?: string; username?: string; password?: string;
  }) {
    return this.servers.update(admin.tenantId, id, body);
  }

  @Patch(':id/toggle')
  toggle(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.servers.toggle(admin.tenantId, id, enabled);
  }

  @Delete(':id')
  remove(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.servers.remove(admin.tenantId, id);
  }
}
