import { IsString, IsNotEmpty } from 'class-validator';

export class CreateDossierDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}
