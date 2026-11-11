import {ApiGeoPolicyService} from './api-geo-policy.service';
/**
 * Makes Supabase Auth verification available across the API.
 *
 * Global for the same reason `PrismaModule` is: any controller may opt in to
 * `SupabaseAuthGuard` without every feature module having to re-import it.
 * `PrismaService`, which the guard depends on, is already global.
 *
 * Registering these providers does NOT change any existing route. A controller
 * must explicitly `@UseGuards(SupabaseAuthGuard)` to adopt it, so the hybrid
 * migration can proceed one module at a time.
 */
import { Global, Module } from '@nestjs/common';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Global()
@Module({
  providers: [ApiGeoPolicyService, SupabaseAuthService, SupabaseAuthGuard],
  exports: [ApiGeoPolicyService, SupabaseAuthService, SupabaseAuthGuard],
})
export class SupabaseAuthModule {}
