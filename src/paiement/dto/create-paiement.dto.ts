import {
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  IsDateString,
  IsPositive,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaiementMode } from '@prisma/client';

export class ChequeDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  montant: number;

  @IsDateString()
  dateEncaissementPrevue: string;
}

export class ChoosePaiementDto {
  @IsEnum(PaiementMode)
  mode: PaiementMode;

  @ValidateIf((o: ChoosePaiementDto) => o.mode === PaiementMode.CHEQUES)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChequeDto)
  cheques?: ChequeDto[];
}
