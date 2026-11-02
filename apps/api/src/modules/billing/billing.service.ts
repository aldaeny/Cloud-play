import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PaymentAdapter } from './payment.adapter';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService, private readonly payments: PaymentAdapter) {}

  async getPlans(tenantId: string) {
    return this.prisma.plan.findMany({
      where: { tenantId, active: true },
      orderBy: { priceCents: 'asc' },
    });
  }

  async getSubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true, invoices: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCurrentSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', currentPeriodEnd: { gt: new Date() }, plan: { active: true } },
      include: { plan: true },
    });
  }

  async checkout(userId: string, planId: string, tenantId: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.active) throw new BadRequestException('Plan is not active');

    // Never activate a subscription or mark an invoice paid without a verified payment.
    return this.payments.createCheckout({ userId, planId, amountCents: plan.priceCents, currency: plan.currency });
  }

  async cancelSubscription(userId: string, subscriptionId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });
    if (!sub) throw new NotFoundException('Subscription not found');

    if (!sub.providerRef) throw new ServiceUnavailableException('Subscription cancellation requires an integrated payment provider');
    await this.payments.cancelSubscription(sub.providerRef);
    return this.prisma.subscription.update({
      where: { id: subscriptionId, userId },
      data: { status: 'CANCELED' },
    });
  }

  async getInvoices(userId: string) {
    return this.prisma.invoice.findMany({
      where: { subscription: { userId } },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async redeemCoupon(userId: string, code: string) {
    // Applying a coupon without applying it to checkout would report a discount
    // that was never granted. Keep this disabled until billing is integrated.
    void userId; void code;
    throw new ServiceUnavailableException('Coupon redemption requires an integrated payment provider');
  }
}
