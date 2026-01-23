import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChequeStatus } from '@prisma/client';

@Injectable()
export class ChequesService {
  private readonly logger = new Logger(ChequesService.name);

  constructor(private prisma: PrismaService) {}

  async updateStatus(chequeId: string, newStatus: ChequeStatus) {
    const cheque = await this.prisma.cheque.findUnique({
      where: { id: chequeId },
      include: {
        paiement: {
          include: {
            dossier: true,
          },
        },
      },
    });

    if (!cheque) {
      throw new NotFoundException('Cheque not found');
    }

    this.validateStatusTransition(cheque.status, newStatus);

    const updateData: {
      status: ChequeStatus;
      dateRecu?: Date;
      dateEncaisse?: Date;
    } = {
      status: newStatus,
    };

    if (newStatus === ChequeStatus.RECU && !cheque.dateRecu) {
      updateData.dateRecu = new Date();
    }

    if (newStatus === ChequeStatus.ENCAISSE && !cheque.dateEncaisse) {
      updateData.dateEncaisse = new Date();
      if (!cheque.dateRecu) {
        updateData.dateRecu = new Date();
      }
    }

    const updatedCheque = await this.prisma.cheque.update({
      where: { id: chequeId },
      data: updateData,
      include: {
        paiement: true,
      },
    });

    this.logger.log(`Cheque ${chequeId} status updated to ${newStatus}`);

    return updatedCheque;
  }

  private validateStatusTransition(
    currentStatus: ChequeStatus,
    newStatus: ChequeStatus,
  ) {
    const validTransitions: Record<ChequeStatus, ChequeStatus[]> = {
      [ChequeStatus.ATTENDU]: [ChequeStatus.RECU, ChequeStatus.ENCAISSE],
      [ChequeStatus.RECU]: [ChequeStatus.ENCAISSE],
      [ChequeStatus.ENCAISSE]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  async findAll(filters?: {
    paiementId?: string;
    status?: ChequeStatus;
    dossierId?: string;
  }) {
    return this.prisma.cheque.findMany({
      where: {
        ...(filters?.paiementId && { paiementId: filters.paiementId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.dossierId && {
          paiement: { dossierId: filters.dossierId },
        }),
      },
      include: {
        paiement: {
          include: {
            dossier: {
              include: {
                client: true,
              },
            },
          },
        },
      },
      orderBy: [{ paiement: { createdAt: 'desc' } }, { numero: 'asc' }],
    });
  }

  async findOne(chequeId: string) {
    const cheque = await this.prisma.cheque.findUnique({
      where: { id: chequeId },
      include: {
        paiement: {
          include: {
            dossier: {
              include: {
                client: true,
              },
            },
          },
        },
      },
    });

    if (!cheque) {
      throw new NotFoundException('Cheque not found');
    }

    return cheque;
  }

  async getChequesByDossier(dossierId: string) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        paiements: {
          include: {
            cheques: {
              orderBy: { numero: 'asc' },
            },
          },
        },
      },
    });

    if (!dossier) {
      throw new NotFoundException('Dossier not found');
    }

    const cheques = dossier.paiements.flatMap((p) => p.cheques);

    return {
      dossierId,
      totalCheques: cheques.length,
      cheques,
      summary: {
        attendu: cheques.filter((c) => c.status === ChequeStatus.ATTENDU)
          .length,
        recu: cheques.filter((c) => c.status === ChequeStatus.RECU).length,
        encaisse: cheques.filter((c) => c.status === ChequeStatus.ENCAISSE)
          .length,
      },
    };
  }
}
