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
import { EditorialService } from './editorial.service';
import { PrismaService } from '../../prisma.service';
import { AdminJwtGuard, RequirePermissions, CurrentAdmin, AdminPrincipal } from '../../common';

@Controller('admin')
@UseGuards(AdminJwtGuard)
export class EditorialController {
  constructor(
    private readonly editorialService: EditorialService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Titles CRUD ──────────────────────────────────────────
  @Post('titles')
  @RequirePermissions('titles:create')
  async createTitle(@CurrentAdmin() admin: AdminPrincipal, @Body() body: Omit<Parameters<EditorialService['createTitle']>[0], 'tenantId'>) {
    const tenantId = await this.getTenantId(admin.id);
    return this.editorialService.createTitle({ ...body, tenantId });
  }

  @Get('titles')
  async getTitles(@CurrentAdmin() admin: AdminPrincipal, @Query('state') state?: string) {
    const tenantId = await this.getTenantId(admin.id);
    return this.editorialService.getTitles(tenantId, state);
  }

  @Get('titles/:id')
  async getTitle(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.editorialService.getTitle(admin.tenantId, id);
  }

  @Put('titles/:id')
  @RequirePermissions('titles:edit')
  async updateTitle(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() body: Parameters<EditorialService['updateTitle']>[2]) {
    return this.editorialService.updateTitle(admin.tenantId, id, body);
  }

  @Delete('titles/:id')
  @RequirePermissions('titles:delete')
  async deleteTitle(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.editorialService.deleteTitle(admin.tenantId, id);
  }

  // ── Seasons CRUD ─────────────────────────────────────────
  @Post('titles/:id/seasons')
  @RequirePermissions('titles:edit')
  async createSeason(@CurrentAdmin() admin: AdminPrincipal, @Param('id') titleId: string, @Body('number') number: number) {
    return this.editorialService.createSeason(admin.tenantId, titleId, number);
  }

  @Delete('seasons/:id')
  @RequirePermissions('titles:edit')
  async deleteSeason(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.editorialService.deleteSeason(admin.tenantId, id);
  }

  // ── Episodes CRUD ────────────────────────────────────────
  @Post('titles/:id/episodes')
  @RequirePermissions('titles:edit')
  async createEpisode(@CurrentAdmin() admin: AdminPrincipal, @Param('id') titleId: string, @Body() body: Omit<Parameters<EditorialService['createEpisode']>[1], 'titleId'>) {
    return this.editorialService.createEpisode(admin.tenantId, { ...body, titleId });
  }

  @Get('titles/:id/episodes')
  async getEpisodes(@CurrentAdmin() admin: AdminPrincipal, @Param('id') titleId: string) {
    return this.editorialService.getEpisodes(admin.tenantId, titleId);
  }

  @Put('episodes/:id')
  @RequirePermissions('titles:edit')
  async updateEpisode(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() body: Parameters<EditorialService['updateEpisode']>[2]) {
    return this.editorialService.updateEpisode(admin.tenantId, id, body);
  }

  @Delete('episodes/:id')
  @RequirePermissions('titles:edit')
  async deleteEpisode(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.editorialService.deleteEpisode(admin.tenantId, id);
  }

  // ── Rights Windows ──────────────────────────────────────
  @Post('titles/:id/rights')
  @RequirePermissions('rights:manage')
  async createRights(@CurrentAdmin() admin: AdminPrincipal, @Param('id') titleId: string, @Body() body: Omit<Parameters<EditorialService['createRightsWindow']>[1], 'titleId'>) {
    return this.editorialService.createRightsWindow(admin.tenantId, { ...body, titleId });
  }

  @Put('rights/:id')
  @RequirePermissions('rights:manage')
  async updateRights(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string, @Body() body: Parameters<EditorialService['updateRightsWindow']>[2]) {
    return this.editorialService.updateRightsWindow(admin.tenantId, id, body);
  }

  // ── Home Rows ───────────────────────────────────────────
  @Post('home/rows')
  @RequirePermissions('home:manage')
  async createHomeRow(@CurrentAdmin() admin: AdminPrincipal, @Body() body: { name: string; order?: number }) {
    const tenantId = await this.getTenantId(admin.id);
    return this.editorialService.createHomeRow(tenantId, body.name, body.order || 0);
  }

  @Post('home/rows/:id/items')
  @RequirePermissions('home:manage')
  async addToHomeRow(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') homeRowId: string,
    @Body() body: { titleId: string; order: number },
  ) {
    return this.editorialService.addToHomeRow(admin.tenantId, homeRowId, body.titleId, body.order);
  }

  @Delete('home/rows/:id/items/:titleId')
  @RequirePermissions('home:manage')
  async removeFromHomeRow(@CurrentAdmin() admin: AdminPrincipal, @Param('id') homeRowId: string, @Param('titleId') titleId: string) {
    return this.editorialService.removeFromHomeRow(admin.tenantId, homeRowId, titleId);
  }

  @Delete('home/rows/:id')
  @RequirePermissions('home:manage')
  async deleteHomeRow(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    return this.editorialService.deleteHomeRow(admin.tenantId, id);
  }

  private async getTenantId(staffId: string): Promise<string> {
    const staff = await this.prisma.staffUser.findUnique({ where: { id: staffId } });
    if (!staff) throw new Error('Staff user not found');
    return staff.tenantId;
  }
}
