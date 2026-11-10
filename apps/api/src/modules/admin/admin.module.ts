import { ExternalPlaybackSessionService } from './external-playback-session.service';
import { ExternalReportsService } from './external-reports.service';
import { ExternalPlaybackController } from './external-playback.controller';
import { ExternalChannelsService } from './external-channels.service';
import { ExternalChannelsController } from './external-channels.controller';
import { ExternalMonitorService } from './external-monitor.service';
import { ExternalServersController } from './external-servers.controller';
import { ExternalServersService } from './external-servers.service';
import { XtreamSyncRunner } from './xtream-sync-runner.service';
import { XtreamProviderAdapter } from './xtream-provider.adapter';
import { XtreamCatalogSyncController } from './xtream-catalog-sync.controller';
import { XtreamCatalogSyncService } from './xtream-catalog-sync.service';
import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { XtreamServersController } from './xtream-servers.controller';
import { XtreamServersService } from './xtream-servers.service';
import { XtreamHealthService } from './xtream-health.service';

@Module({
  controllers: [ExternalPlaybackController, ExternalChannelsController, ExternalServersController, AdminController, XtreamServersController, XtreamCatalogSyncController],
  providers: [ExternalPlaybackSessionService, ExternalReportsService, ExternalChannelsService, ExternalMonitorService, ExternalServersService, XtreamSyncRunner, XtreamProviderAdapter, AdminService, XtreamServersService, XtreamHealthService, XtreamCatalogSyncService],
  exports: [AdminService, XtreamHealthService],
})
export class AdminModule {}
