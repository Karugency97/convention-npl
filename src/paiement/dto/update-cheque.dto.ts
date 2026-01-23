import { IsEnum } from 'class-validator';
import { ChequeStatus } from '@prisma/client';

export class UpdateChequeStatusDto {
  @IsEnum(ChequeStatus)
  status: ChequeStatus;
}
