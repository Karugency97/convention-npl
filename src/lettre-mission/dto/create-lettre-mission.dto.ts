import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLettreMissionDto {
  @IsString()
  missionDescription: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  @Min(0.01)
  totalAmount: number;

  @IsOptional()
  @IsString()
  honorairesDetails?: string;
}
