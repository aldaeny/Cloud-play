import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/supabase-auth.guard';
import { CurrentUser, type UserRequest } from '../../common/permissions.decorator';
import { ProfilesService } from './profiles.service';

/** Additive migration surface: no legacy JWT route is replaced. */
@Controller('hybrid/profiles')
@UseGuards(SupabaseAuthGuard)
export class HybridProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@CurrentUser() user: UserRequest) {
    // Ownership comes exclusively from the verified Supabase/business account.
    // No caller-provided userId, email or tenant is accepted.
    return { data: await this.profiles.getProfiles(user.id) };
  }
}
