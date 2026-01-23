import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayPlugService } from './payplug.service';
import { ChoosePaiementDto } from './dto/create-paiement.dto';
import {
  DossierStatus,
  PaiementMode,
  PaiementStatus,
  ChequeStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PaiementService {
  private readonly logger = new Logger(PaiementService.name);

  constructor(
    private prisma: PrismaService,
    private payplugService: PayPlugService,
  ) {}

  async choosePaiement(dossierId: string, dto: ChoosePaiementDto) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        client: true,
        lettreMission: true,
        paiements: true,
      },
    });

    if (!dossier) {
      throw new NotFoundException('Dossier not found');
    }

    if (dossier.status !== DossierStatus.SIGNED) {
      throw new BadRequestException(
        'Payment can only be chosen after signature. Current status: ' +
          dossier.status,
      );
    }

    if (!dossier.lettreMission) {
      throw new BadRequestException('Lettre de mission not found');
    }

    const existingPaiement = dossier.paiements.find(
      (p) =>
        p.status === PaiementStatus.PENDING ||
        p.status === PaiementStatus.COMPLETED,
    );

    if (existingPaiement) {
      throw new BadRequestException(
        'Payment already initiated for this dossier',
      );
    }

    const totalAmount = dossier.lettreMission.totalAmount;

    if (dto.mode === PaiementMode.CHEQUES) {
      return this.handleChequePayment(dossier, dto, totalAmount);
    } else {
      return this.handlePayPlugPayment(dossier, totalAmount);
    }
  }

  private async handleChequePayment(
    dossier: {
      id: string;
      reference: string;
      lettreMission: { totalAmount: Decimal } | null;
    },
    dto: ChoosePaiementDto,
    totalAmount: Decimal,
  ) {
    if (!dto.cheques || dto.cheques.length === 0) {
      throw new BadRequestException('Cheques are required for CHEQUES mode');
    }

    const chequesTotal = dto.cheques.reduce((sum, c) => sum + c.montant, 0);

    if (Math.abs(chequesTotal - totalAmount.toNumber()) > 0.01) {
      throw new BadRequestException(
        `Total of cheques (${chequesTotal}) must equal total amount (${totalAmount.toString()})`,
      );
    }

    const paiement = await this.prisma.$transaction(async (tx) => {
      const newPaiement = await tx.paiement.create({
        data: {
          dossierId: dossier.id,
          mode: PaiementMode.CHEQUES,
          status: PaiementStatus.COMPLETED,
          amount: totalAmount,
          paidAt: new Date(),
          cheques: {
            create: dto.cheques!.map((cheque, index) => ({
              numero: index + 1,
              montant: new Decimal(cheque.montant),
              dateEncaissementPrevue: new Date(cheque.dateEncaissementPrevue),
              status: ChequeStatus.ATTENDU,
            })),
          },
        },
        include: {
          cheques: true,
        },
      });

      await tx.dossier.update({
        where: { id: dossier.id },
        data: {
          status: DossierStatus.PAID,
        },
      });

      return newPaiement;
    });

    this.logger.log(
      `Cheque payment registered for dossier: ${dossier.id} with ${dto.cheques.length} cheques`,
    );

    return {
      paiement,
      message: 'Paiement par chèques enregistré avec succès',
    };
  }

  private async handlePayPlugPayment(
    dossier: {
      id: string;
      reference: string;
      client: { email: string; firstName: string; lastName: string };
    },
    totalAmount: Decimal,
  ) {
    const paiement = await this.prisma.paiement.create({
      data: {
        dossierId: dossier.id,
        mode: PaiementMode.PAYPLUG,
        status: PaiementStatus.PENDING,
        amount: totalAmount,
      },
    });

    const amountCents = Math.round(totalAmount.toNumber() * 100);

    const { paymentId, paymentUrl } = await this.payplugService.createPayment(
      amountCents,
      {
        dossierId: dossier.id,
        paiementId: paiement.id,
        reference: dossier.reference,
      },
      {
        email: dossier.client.email,
        firstName: dossier.client.firstName,
        lastName: dossier.client.lastName,
      },
    );

    const updatedPaiement = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.paiement.update({
        where: { id: paiement.id },
        data: {
          payplugPaymentId: paymentId,
          payplugUrl: paymentUrl,
        },
      });

      await tx.dossier.update({
        where: { id: dossier.id },
        data: {
          status: DossierStatus.PAYMENT_PENDING,
        },
      });

      return updated;
    });

    this.logger.log(
      `PayPlug payment created for dossier: ${dossier.id}, paymentId: ${paymentId}`,
    );

    return {
      paiement: updatedPaiement,
      paymentUrl,
      message: 'Redirection vers la page de paiement',
    };
  }

  async handlePayPlugWebhook(
    payload: {
      event: string;
      data: {
        id: string;
        metadata?: { paiementId?: string; dossierId?: string };
        failure_code?: string;
      };
    },
    rawBody: string,
    signature: string,
  ) {
    if (!this.payplugService.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const existingEvent = await this.prisma.webhookEvent.findFirst({
      where: {
        source: 'payplug',
        eventType: payload.event,
        payload: {
          path: ['data', 'id'],
          equals: payload.data.id,
        },
        processed: true,
      },
    });

    if (existingEvent) {
      this.logger.log(
        `Duplicate PayPlug webhook ignored: ${payload.event} for ${payload.data.id}`,
      );
      return { status: 'already_processed' };
    }

    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        source: 'payplug',
        eventType: payload.event,
        payload: payload as object,
      },
    });

    try {
      switch (payload.event) {
        case 'payment.succeeded':
          await this.handlePaymentSucceeded(payload.data);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(payload.data);
          break;
        default:
          this.logger.warn(`Unknown PayPlug event: ${payload.event}`);
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true },
      });

      return { status: 'processed' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { error: errorMessage },
      });
      throw error;
    }
  }

  private async handlePaymentSucceeded(data: {
    id: string;
    metadata?: { paiementId?: string };
  }) {
    const paiement = await this.prisma.paiement.findUnique({
      where: { payplugPaymentId: data.id },
      include: { dossier: true },
    });

    if (!paiement) {
      throw new NotFoundException(
        `Paiement not found for PayPlug ID: ${data.id}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.paiement.update({
        where: { id: paiement.id },
        data: {
          status: PaiementStatus.COMPLETED,
          paidAt: new Date(),
        },
      }),
      this.prisma.dossier.update({
        where: { id: paiement.dossierId },
        data: {
          status: DossierStatus.PAID,
        },
      }),
    ]);

    this.logger.log(
      `PayPlug payment succeeded for dossier: ${paiement.dossierId}`,
    );
  }

  private async handlePaymentFailed(data: {
    id: string;
    failure_code?: string;
  }) {
    const paiement = await this.prisma.paiement.findUnique({
      where: { payplugPaymentId: data.id },
      include: { dossier: true },
    });

    if (!paiement) {
      throw new NotFoundException(
        `Paiement not found for PayPlug ID: ${data.id}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.paiement.update({
        where: { id: paiement.id },
        data: {
          status: PaiementStatus.FAILED,
        },
      }),
      this.prisma.dossier.update({
        where: { id: paiement.dossierId },
        data: {
          status: DossierStatus.SIGNED,
        },
      }),
    ]);

    this.logger.log(
      `PayPlug payment failed for dossier: ${paiement.dossierId}, code: ${data.failure_code}`,
    );
  }

  async findOne(paiementId: string) {
    const paiement = await this.prisma.paiement.findUnique({
      where: { id: paiementId },
      include: {
        cheques: {
          orderBy: { numero: 'asc' },
        },
        dossier: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!paiement) {
      throw new NotFoundException('Paiement not found');
    }

    return paiement;
  }

  async findByDossier(dossierId: string) {
    const paiements = await this.prisma.paiement.findMany({
      where: { dossierId },
      include: {
        cheques: {
          orderBy: { numero: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return paiements;
  }
}
