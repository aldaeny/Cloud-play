import { jwtTtlSeconds } from './common/token-ttl';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RightsModule } from './modules/rights/rights.module';
import { PlaybackModule } from './modules/playback/playback.module';
import { MediaModule } from './modules/media/media.module';
import { EntitlementModule } from './modules/entitlement/entitlement.module';
import { BillingModule } from './modules/billing/billing.module';
import { EditorialModule } from './modules/editorial/editorial.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SupportModule } from './modules/support/support.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: jwtTtlSeconds('JWT_ACCESS_TTL', 900) },
    }),
    PrismaModule,
    CatalogModule,
    IdentityModule,
    ProfilesModule,
    RightsModule,
    PlaybackModule,
    MediaModule,
    EntitlementModule,
    BillingModule,
    EditorialModule,
    AdminModule,
    NotificationsModule,
    SupportModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
