import { IsString, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FirmaWebhookDataDto {
  @IsString()
  signing_request_id: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  final_document_download_url?: string;

  @IsOptional()
  @IsObject()
  recipient?: Record<string, unknown>;
}

export class FirmaWebhookDto {
  @IsString()
  event_id: string;

  @IsString()
  event_type: string;

  @IsString()
  timestamp: string;

  @IsOptional()
  @IsString()
  company_id?: string;

  @IsOptional()
  @IsString()
  workspace_id?: string;

  @ValidateNested()
  @Type(() => FirmaWebhookDataDto)
  data: FirmaWebhookDataDto;
}
