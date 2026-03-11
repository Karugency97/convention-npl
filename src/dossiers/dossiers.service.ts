import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { DossierStatus, Prisma } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

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

  async findAllPaginated(
    paginationDto: PaginationDto,
    filters?: { status?: DossierStatus; clientId?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, search, sortBy, sortOrder = 'desc' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.DossierWhereInput = {
      ...(filters?.status && { status: filters.status }),
      ...(filters?.clientId && { clientId: filters.clientId }),
    };

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          client: {
            firstName: { contains: search, mode: 'insensitive' },
          },
        },
        {
          client: {
            lastName: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const orderBy: Record<string, string> = {};
    if (sortBy && ['reference', 'description', 'status', 'createdAt', 'updatedAt'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [data, total] = await Promise.all([
      this.prisma.dossier.findMany({
        where,
        include: {
          client: true,
          lettreMission: true,
          paiements: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.dossier.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
