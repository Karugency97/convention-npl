import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SignatureService } from './signature.service';
import { FirmaWebhookDto } from './dto/firma-webhook.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('webhooks')
export class SignatureWebhookController {
  constructor(private readonly signatureService: SignatureService) {}

  @Public()
  @Post('firma')
  @HttpCode(HttpStatus.OK)
  async handleFirmaWebhook(
    @Body() payload: FirmaWebhookDto,
    @Headers('x-firma-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing webhook signature');
    }

    return this.signatureService.handleWebhook(payload, signature);
  }
}
