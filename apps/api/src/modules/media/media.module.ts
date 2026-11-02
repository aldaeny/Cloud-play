import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController, AdminMediaController } from './media.controller';
import { StorageService } from '../../common/storage.service';

@Module({
  controllers: [MediaController, AdminMediaController],
  providers: [MediaService, StorageService],
  exports: [MediaService, StorageService],
})
export class MediaModule {}
