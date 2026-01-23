import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { DossierStatus } from '@prisma/client';

@Injectable()
export class DossiersService {
  constructor(private prisma: PrismaService) {}

  async create(createDossierDto: CreateDossierDto) {
    const client = await this.prisma.client.findUnique({
      where: { id: createDossierDto.clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const reference = await this.generateReference();

    return this.prisma.dossier.create({
      data: {
        reference,
        clientId: createDossierDto.clientId,
        description: createDossierDto.description,
      },
      include: {
        client: true,
      },
    });
  }

  async findAll(filters?: { status?: DossierStatus; clientId?: string }) {
    return this.prisma.dossier.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.clientId && { clientId: filters.clientId }),
      },
      include: {
        client: true,
        lettreMission: true,
        paiements: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: true,
        lettreMission: true,
        paiements: {
          include: {
            cheques: true,
          },
        },
      },
    });

    if (!dossier) {
      throw new NotFoundException('Dossier not found');
    }

    return dossier;
  }

  async update(id: string, updateDossierDto: UpdateDossierDto) {
    await this.findOne(id);

    return this.prisma.dossier.update({
      where: { id },
      data: updateDossierDto,
      include: {
        client: true,
        lettreMission: true,
        paiements: true,
      },
    });
  }

  async remove(id: string) {
    const dossier = await this.findOne(id);

    if (dossier.status !== DossierStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT dossiers can be deleted');
    }

    return this.prisma.dossier.delete({
      where: { id },
    });
  }

  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DOS-${year}-`;

    const lastDossier = await this.prisma.dossier.findFirst({
      where: {
        reference: {
          startsWith: prefix,
        },
      },
      orderBy: {
        reference: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastDossier) {
      const lastNumber = parseInt(lastDossier.reference.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    const paddedNumber = nextNumber.toString().padStart(3, '0');
    return `${prefix}${paddedNumber}`;
  }
}
