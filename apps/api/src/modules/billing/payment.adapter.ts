import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface CheckoutRequest { userId: string; planId: string; amountCents: number; currency: string }
export interface CheckoutResult { provider: string; transactionId: string; checkoutUrl: string }
/** A real provider must verify signatures over the raw webhook body and implement idempotency. */
export interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  verifyWebhook(rawBody: Buffer, signature: string): Promise<boolean>;
  cancelSubscription(providerReference: string): Promise<void>;
  refundPayment(providerReference: string): Promise<void>;
}
@Injectable()
export class PaymentAdapter implements PaymentProvider {
  private unavailable(): never { throw new ServiceUnavailableException('No verified sandbox payment provider configured'); }
  async createCheckout(_request: CheckoutRequest): Promise<CheckoutResult> { void _request; return this.unavailable(); }
  async verifyWebhook(_rawBody: Buffer, _signature: string): Promise<boolean> { void _rawBody; void _signature; return this.unavailable(); }
  async cancelSubscription(_providerReference: string): Promise<void> { void _providerReference; return this.unavailable(); }
  async refundPayment(_providerReference: string): Promise<void> { void _providerReference; return this.unavailable(); }
}
