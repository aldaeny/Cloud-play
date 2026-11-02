import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type UserRequest } from '../../common/permissions.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: UserRequest,
    @Query('unread') unread?: string,
  ) {
    return this.notificationsService.getNotifications(
      user.id,
      unread === 'true',
    );
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: UserRequest) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Post(':id/read')
  async markAsRead(
    @CurrentUser() user: UserRequest,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: UserRequest) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete(':id')
  async deleteNotification(
    @CurrentUser() user: UserRequest,
    @Param('id') id: string,
  ) {
    return this.notificationsService.deleteNotification(id, user.id);
  }
}
