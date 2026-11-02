import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type UserRequest } from '../../common/permissions.decorator';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('home')
  @UseGuards(JwtAuthGuard)
  async getHome(@CurrentUser() user: UserRequest) {
    const homeRows = await this.catalogService.getHomeRows(user.tenantId);

    // Get continue-watching for the first profile
    const continueWatching = user.profiles.length > 0
      ? await this.catalogService.getContinueWatching(user.tenantId, user.profiles[0])
      : [];

    const trending = await this.catalogService.getTrending(user.tenantId);
    const banners = await this.catalogService.getBanners(user.tenantId);

    return {
      rows: homeRows,
      continueWatching,
      trending,
      banners,
    };
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(
    @CurrentUser() user: UserRequest,
    @Query('q') q?: string,
    @Query('genre') genre?: string,
    @Query('year') year?: string,
    @Query('lang') lang?: string,
    @Query('rating') rating?: string,
  ) {
    return this.catalogService.search(
      user.tenantId,
      q,
      genre,
      year ? parseInt(year, 10) : undefined,
      lang,
      rating,
    );
  }

  @Get('titles/:id')
  @UseGuards(JwtAuthGuard)
  async getTitle(@CurrentUser() user: UserRequest, @Param('id') id: string) {
    return this.catalogService.getTitleDetails(user.tenantId, id);
  }

  @Get('titles/:id/episodes')
  @UseGuards(JwtAuthGuard)
  async getEpisodes(@CurrentUser() user: UserRequest, @Param('id') id: string) {
    return this.catalogService.getEpisodes(user.tenantId, id);
  }
}
