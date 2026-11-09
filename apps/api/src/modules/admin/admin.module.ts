import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { XtreamServersController } from './xtream-servers.controller';
import { XtreamServersService } from './xtream-servers.service';
import { XtreamHealthService } from './xtream-health.service';

@Module({
  controllers: [AdminController, XtreamServersController],
  providers: [AdminService, XtreamServersService, XtreamHealthService],
  exports: [AdminService, XtreamHealthService],
})
export class AdminModule {}
