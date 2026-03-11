import {
  IsEnum,
  IsNumber,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';
import { plainToClass } from 'class-transformer';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  API_KEY: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  S3_REGION: string;

  @IsUrl({ require_tld: false })
  S3_ENDPOINT: string;

  @IsString()
  S3_BUCKET: string;

  @IsString()
  S3_ACCESS_KEY_ID: string;

  @IsString()
  S3_SECRET_ACCESS_KEY: string;

  @IsString()
  FIRMA_API_KEY: string;

  @IsUrl({ require_tld: false })
  FIRMA_API_URL: string;

  @IsString()
  FIRMA_WEBHOOK_SECRET: string;

  @IsString()
  PAYPLUG_API_KEY: string;

  @IsUrl({ require_tld: false })
  PAYPLUG_API_URL: string;

  @IsString()
  PAYPLUG_WEBHOOK_SECRET: string;

  @IsUrl({ require_tld: false })
  APP_URL: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => Object.values(e.constraints || {}).join(', ')).join('\n')}`,
    );
  }

  return validatedConfig;
}
