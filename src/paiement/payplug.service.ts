import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface PayPlugPaymentRequest {
  amount: number;
  currency: string;
  notification_url: string;
  return_url: string;
  metadata: Record<string, string>;
  customer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
  };
}

interface PayPlugPaymentResponse {
  id: string;
  object: string;
  amount: number;
  currency: string;
  hosted_payment: {
    payment_url: string;
    return_url: string;
    cancel_url: string;
  };
  notification_url: string;
  metadata: Record<string, string>;
}

@Injectable()
export class PayPlugService {
  private readonly logger = new Logger(PayPlugService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly webhookSecret: string;
  private readonly appUrl: string;
  private readonly frontendUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('PAYPLUG_API_KEY')!;
    this.apiUrl = this.configService.get<string>('PAYPLUG_API_URL')!;
    this.webhookSecret = this.configService.get<string>(
      'PAYPLUG_WEBHOOK_SECRET',
    )!;
    this.appUrl = this.configService.get<string>('APP_URL')!;
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL')!;
  }

  async createPayment(
    amountCents: number,
    metadata: Record<string, string>,
    customer?: {
      email?: string;
      firstName?: string;
      lastName?: string;
    },
  ): Promise<{ paymentId: string; paymentUrl: string }> {
    const paymentRequest: PayPlugPaymentRequest = {
      amount: amountCents,
      currency: 'EUR',
      notification_url: `${this.appUrl}/webhooks/payplug`,
      return_url: `${this.frontendUrl}/payment/return?paiement_id=${metadata.paiementId}`,
      metadata,
    };

    if (customer) {
      paymentRequest.customer = {
        email: customer.email,
        first_name: customer.firstName,
        last_name: customer.lastName,
      };
    }

    const response = await fetch(`${this.apiUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`PayPlug API error: ${error}`);
      throw new BadRequestException('Failed to create payment');
    }

    const paymentResponse = (await response.json()) as PayPlugPaymentResponse;

    this.logger.log(`PayPlug payment created: ${paymentResponse.id}`);

    return {
      paymentId: paymentResponse.id,
      paymentUrl: paymentResponse.hosted_payment.payment_url,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const computedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature),
      );
    } catch {
      return false;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<{
    id: string;
    is_paid: boolean;
    is_refunded: boolean;
    failure?: { code: string; message: string };
  }> {
    const response = await fetch(`${this.apiUrl}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to get payment status');
    }

    return response.json() as Promise<{
      id: string;
      is_paid: boolean;
      is_refunded: boolean;
      failure?: { code: string; message: string };
    }>;
  }
}
