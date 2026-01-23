import { IsString, IsObject, IsOptional } from 'class-validator';

export class FirmaWebhookDto {
  @IsString()
  event: string;

  @IsString()
  signature_id: string;

  @IsOptional()
  @IsString()
  signed_document_url?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  timestamp?: string;
}
