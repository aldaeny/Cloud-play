import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type UserRequest } from '../../common/permissions.decorator';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  async createTicket(
    @CurrentUser() user: UserRequest,
    @Body('subject') subject: string,
    @Body('message') message: string,
  ) {
    if (!subject || !message) {
      throw new BadRequestException('subject and message are required');
    }
    return this.supportService.createTicket(user.id, subject, message);
  }

  @Get('tickets')
  async getTickets(@CurrentUser() user: UserRequest) {
    return this.supportService.getTickets(user.id);
  }

  @Get('tickets/:id')
  async getTicket(
    @CurrentUser() user: UserRequest,
    @Param('id') id: string,
  ) {
    return this.supportService.getTicket(user.id, id);
  }

  @Put('tickets/:id/status')
  async updateStatus(
    @CurrentUser() user: UserRequest,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.supportService.updateTicketStatus(user.id, id, status);
  }
}
