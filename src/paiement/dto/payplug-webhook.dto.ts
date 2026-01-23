import { IsString, IsObject, IsOptional, IsNumber } from 'class-validator';

export class PayPlugPaymentDto {
  @IsString()
  id: string;

  @IsString()
  object: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  failure_code?: string;
}

export class PayPlugWebhookDto {
  @IsString()
  event: string;

  @IsObject()
  data: PayPlugPaymentDto;
}
