import { IsString, IsOptional, IsEnum } from 'class-validator';
import { DossierStatus } from '@prisma/client';

export class UpdateDossierDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DossierStatus)
  @IsOptional()
  status?: DossierStatus;
}
