import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../../prisma.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type UserRequest } from '../../common/permissions.decorator';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('plans')
  async getPlans(@CurrentUser() user: UserRequest) {
    return this.billingService.getPlans(user.tenantId);
  }

  @Get('subscriptions')
  async getSubscriptions(@CurrentUser() user: UserRequest) {
    return this.billingService.getSubscriptions(user.id);
  }

  @Get('subscription/current')
  async getCurrent(@CurrentUser() user: UserRequest) {
    return this.billingService.getCurrentSubscription(user.id);
  }

  @Post('checkout')
  async checkout(
    @CurrentUser() user: UserRequest,
    @Body('plan_id') planId: string,
  ) {
    if (!planId) throw new BadRequestException('plan_id is required');
    return this.billingService.checkout(user.id, planId, user.tenantId);
  }

  @Post('subscription/:id/cancel')
  async cancel(
    @CurrentUser() user: UserRequest,
    @Param('id') id: string,
  ) {
    return this.billingService.cancelSubscription(user.id, id);
  }

  @Get('invoices')
  async getInvoices(@CurrentUser() user: UserRequest) {
    return this.billingService.getInvoices(user.id);
  }

  @Post('coupons/redeem')
  async redeemCoupon(
    @CurrentUser() user: UserRequest,
    @Body('code') code: string,
  ) {
    if (!code) throw new BadRequestException('code is required');
    return this.billingService.redeemCoupon(user.id, code);
  }
}
