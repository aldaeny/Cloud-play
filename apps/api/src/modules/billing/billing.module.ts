import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PaymentAdapter } from './payment.adapter';

@Module({ controllers: [BillingController], providers: [BillingService, PaymentAdapter], exports: [BillingService, PaymentAdapter] })
export class BillingModule {}
