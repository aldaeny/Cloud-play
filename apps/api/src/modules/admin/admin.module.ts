import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { XtreamServersController } from './xtream-servers.controller';
import { XtreamServersService } from './xtream-servers.service';

@Module({
  controllers: [AdminController, XtreamServersController],
  providers: [AdminService, XtreamServersService],
  exports: [AdminService],
})
export class AdminModule {}
