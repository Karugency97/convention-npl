import { Module } from '@nestjs/common';
import { PaiementController } from './paiement.controller';
import { PaiementWebhookController } from './paiement-webhook.controller';
import { PaiementService } from './paiement.service';
import { PayPlugService } from './payplug.service';
import { ChequesService } from './cheques.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaiementController, PaiementWebhookController],
  providers: [PaiementService, PayPlugService, ChequesService],
  exports: [PaiementService, ChequesService],
})
export class PaiementModule {}
