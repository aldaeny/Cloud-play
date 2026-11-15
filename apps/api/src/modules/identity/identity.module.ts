import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { SupabaseAuthController } from './supabase-auth.controller';
import { SupabaseAuthModule } from '../../common/supabase-auth.module';

@Module({
  imports: [JwtModule.register({ global: true }), SupabaseAuthModule],
  providers: [IdentityService],
  controllers: [IdentityController, SupabaseAuthController],
  exports: [IdentityService],
})
export class IdentityModule {}
