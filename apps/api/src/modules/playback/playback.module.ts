import { StorageService } from '../../common/storage.service';
import { VodDeliveryService } from './vod-delivery.service';
import { Module } from '@nestjs/common';
import { PlaybackService } from './playback.service';
import { PlaybackController } from './playback.controller';
import { RightsModule } from '../rights/rights.module';
import { EntitlementModule } from '../entitlement/entitlement.module';

@Module({
  imports: [RightsModule, EntitlementModule],
  controllers: [PlaybackController],
  providers: [PlaybackService, StorageService, VodDeliveryService],
  exports: [PlaybackService],
})
export class PlaybackModule {}
