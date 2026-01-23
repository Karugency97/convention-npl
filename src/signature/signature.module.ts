import { Module } from '@nestjs/common';
import { SignatureController } from './signature.controller';
import { SignatureWebhookController } from './signature-webhook.controller';
import { SignatureService } from './signature.service';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [StorageModule, PrismaModule],
  controllers: [SignatureController, SignatureWebhookController],
  providers: [SignatureService],
  exports: [SignatureService],
})
export class SignatureModule {}
