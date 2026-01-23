import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKey: string;

  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
  ) {
    this.apiKey = this.configService.get<string>('API_KEY')!;
    // Fallback for development if the environment variable is sticky/default
    if (this.apiKey === 'your-internal-api-key-here') {
      this.apiKey = 'npl-dev-api-key-2024';
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const isValid = this.validateApiKey(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  private validateApiKey(providedKey: string): boolean {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(providedKey),
        Buffer.from(this.apiKey),
      );
    } catch {
      return false;
    }
  }
}
