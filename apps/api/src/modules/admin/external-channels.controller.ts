import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminJwtGuard, AdminPrincipal, CurrentAdmin, RequirePermissions } from '../../common';
import { ExternalChannelsService } from './external-channels.service';
@Controller('admin/external-channels')
@UseGuards(AdminJwtGuard)
@RequirePermissions('xtream:manage')
export class ExternalChannelsController {
  constructor(private readonly channels: ExternalChannelsService) {}
  @Get('groups') groups(@CurrentAdmin() a: AdminPrincipal) { return this.channels.groups(a.tenantId); }
  @Post('groups') createGroup(@CurrentAdmin() a: AdminPrincipal, @Body() body: unknown) { return this.channels.createGroup(a.tenantId,a.id,body); }
  @Get() list(@CurrentAdmin() a: AdminPrincipal) { return this.channels.channels(a.tenantId); }
  @Post() create(@CurrentAdmin() a: AdminPrincipal, @Body() body: unknown) { return this.channels.createChannel(a.tenantId,a.id,body); }
  @Post(':id/sources') add(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Body() body: unknown) { return this.channels.addSource(a.tenantId,a.id,id,body); }
  @Put(':id/order') reorder(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Body() body: unknown) { return this.channels.reorder(a.tenantId,a.id,id,body); }
  @Put(':id/policy') policy(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Body() body: unknown) { return this.channels.policy(a.tenantId,a.id,id,body); }
  @Post(':id/sources/:sourceId/approve') @RequirePermissions('xtream:manage','rights:manage','external:publish')
  approve(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Param('sourceId') sourceId: string, @Body() body: unknown) { return this.channels.approveSource(a.tenantId,a.id,id,sourceId,body); }
  @Post(':id/activation') @RequirePermissions('xtream:manage','rights:manage','external:publish')
  activate(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Body() body: unknown) { return this.channels.activate(a.tenantId,a.id,id,body); }
  @Post(':id/sources/:sourceId/disable') disable(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string, @Param('sourceId') sourceId: string) { return this.channels.disableSource(a.tenantId,a.id,id,sourceId); }
  @Post(':id/evaluate') evaluate(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string) { return this.channels.evaluate(a.tenantId,id); }
  @Get(':id/history') history(@CurrentAdmin() a: AdminPrincipal, @Param('id') id: string) { return this.channels.history(a.tenantId,id); }
}
