import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaiementService } from './paiement.service';
import { PayPlugWebhookDto } from './dto/payplug-webhook.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('webhooks')
export class PaiementWebhookController {
  constructor(private readonly paiementService: PaiementService) {}

  @Public()
  @Post('payplug')
  @HttpCode(HttpStatus.OK)
  async handlePayPlugWebhook(
    @Body() payload: PayPlugWebhookDto,
    @Headers('x-payplug-signature') signature: string,
    @Req() req: { body: unknown },
  ) {
    if (!signature) {
      throw new BadRequestException('Missing webhook signature');
    }

    const rawBody =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    return this.paiementService.handlePayPlugWebhook(
      payload,
      rawBody,
      signature,
    );
  }
}
