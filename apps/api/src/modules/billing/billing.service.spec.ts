import type { Subscription } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../../prisma.service';
import { PaymentAdapter } from './payment.adapter';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [BillingService, PrismaService, PaymentAdapter],
    }).compile();

    service = moduleRef.get<BillingService>(BillingService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkout', () => {
    it('fails closed without a verified provider and creates no subscription', async () => {
      jest.spyOn(prisma.plan, 'findFirst').mockResolvedValue({ id: 'plan-1', priceCents: 999, currency: 'USD', active: true } as never);
      const create = jest.spyOn(prisma.subscription, 'create');
      await expect(service.checkout('user-1', 'plan-1', 'tenant-1')).rejects.toThrow('No verified sandbox payment provider configured');
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('cancelSubscription', () => {
    it('fails closed without a provider reference and never changes local status', async () => {
      jest.spyOn(prisma.subscription, 'findFirst').mockResolvedValue({ id: 'sub-1', userId: 'user-1', providerRef: null } as unknown as Subscription);
      const update = jest.spyOn(prisma.subscription, 'update');
      await expect(service.cancelSubscription('user-1', 'sub-1')).rejects.toThrow('Subscription cancellation requires an integrated payment provider');
      expect(update).not.toHaveBeenCalled();
    });
    it('fails closed when the provider is not integrated', async () => {
      jest.spyOn(prisma.subscription, 'findFirst').mockResolvedValue({ id: 'sub-1', userId: 'user-1', providerRef: 'provider-ref' } as unknown as Subscription);
      const update = jest.spyOn(prisma.subscription, 'update');
      await expect(service.cancelSubscription('user-1', 'sub-1')).rejects.toThrow('No verified sandbox payment provider configured');
      expect(update).not.toHaveBeenCalled();
    });
  });
});
