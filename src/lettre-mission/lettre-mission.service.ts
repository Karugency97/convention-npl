import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  PdfGeneratorService,
  LettreMissionTemplateData,
} from './pdf-generator.service';
import { CreateLettreMissionDto } from './dto/create-lettre-mission.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class LettreMissionService {
  private readonly logger = new Logger(LettreMissionService.name);

  private readonly cabinetConfig = {
    address: '15 Avenue des Champs-Élysées, 75008 Paris',
    phone: '+33 1 42 12 34 56',
    email: 'contact@cabinet-npl.fr',
    siret: '123 456 789 00012',
  };

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private pdfGeneratorService: PdfGeneratorService,
    private configService: ConfigService,
  ) {}

  async create(dossierId: string, dto: CreateLettreMissionDto) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        client: true,
        lettreMission: true,
      },
    });

    if (!dossier) {
      throw new NotFoundException('Dossier not found');
    }

    if (dossier.lettreMission) {
      throw new BadRequestException(
        'Lettre de mission already exists for this dossier',
      );
    }

    if (dossier.status !== 'DRAFT') {
      throw new BadRequestException(
        'Lettre de mission can only be created for DRAFT dossiers',
      );
    }

    const now = new Date();
    const templateData: LettreMissionTemplateData = {
      cabinetAddress: this.cabinetConfig.address,
      cabinetPhone: this.cabinetConfig.phone,
      cabinetEmail: this.cabinetConfig.email,
      cabinetSiret: this.cabinetConfig.siret,
      dossierReference: dossier.reference,
      currentDate: this.pdfGeneratorService.formatDate(now),
      clientFullName: `${dossier.client.firstName} ${dossier.client.lastName}`,
      clientAddress: dossier.client.address || 'Adresse non renseignée',
      clientEmail: dossier.client.email,
      clientPhone: dossier.client.phone || undefined,
      missionDescription: dto.missionDescription,
      totalAmountFormatted: this.pdfGeneratorService.formatAmount(
        dto.totalAmount,
      ),
      honorairesDetails: dto.honorairesDetails,
      generatedAt: this.pdfGeneratorService.formatDate(now),
    };

    const pdfBuffer =
      await this.pdfGeneratorService.generateLettreMissionPdf(templateData);

    const pdfKey = this.storageService.generateLettreMissionKey(
      dossierId,
      'generated',
    );
    await this.storageService.uploadFile(pdfKey, pdfBuffer, 'application/pdf');

    const lettreMission = await this.prisma.lettreMission.create({
      data: {
        dossierId,
        templateData: templateData as object,
        pdfUrl: pdfKey,
        pdfGeneratedAt: now,
        totalAmount: new Decimal(dto.totalAmount),
      },
      include: {
        dossier: {
          include: {
            client: true,
          },
        },
      },
    });

    this.logger.log(`Lettre de mission created for dossier: ${dossierId}`);

    return lettreMission;
  }

  async findByDossierId(dossierId: string) {
    const lettreMission = await this.prisma.lettreMission.findUnique({
      where: { dossierId },
      include: {
        dossier: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!lettreMission) {
      throw new NotFoundException('Lettre de mission not found');
    }

    return lettreMission;
  }

  async getPdfDownloadUrl(dossierId: string, signed: boolean = false) {
    const lettreMission = await this.findByDossierId(dossierId);

    const pdfUrl = signed ? lettreMission.signedPdfUrl : lettreMission.pdfUrl;

    if (!pdfUrl) {
      throw new NotFoundException(
        signed ? 'Signed PDF not available' : 'PDF not generated',
      );
    }

    const signedUrl = await this.storageService.getSignedDownloadUrl(
      pdfUrl,
      3600,
    );

    return {
      url: signedUrl,
      expiresIn: 3600,
    };
  }

  async regeneratePdf(dossierId: string) {
    const lettreMission = await this.findByDossierId(dossierId);

    if (lettreMission.sentForSignatureAt) {
      throw new BadRequestException(
        'Cannot regenerate PDF after sending for signature',
      );
    }

    const templateData =
      lettreMission.templateData as unknown as LettreMissionTemplateData;

    const now = new Date();
    templateData.currentDate = this.pdfGeneratorService.formatDate(now);
    templateData.generatedAt = this.pdfGeneratorService.formatDate(now);

    const pdfBuffer =
      await this.pdfGeneratorService.generateLettreMissionPdf(templateData);

    const pdfKey = this.storageService.generateLettreMissionKey(
      dossierId,
      'generated',
    );
    await this.storageService.uploadFile(pdfKey, pdfBuffer, 'application/pdf');

    const updated = await this.prisma.lettreMission.update({
      where: { dossierId },
      data: {
        templateData: templateData as object,
        pdfUrl: pdfKey,
        pdfGeneratedAt: now,
      },
      include: {
        dossier: {
          include: {
            client: true,
          },
        },
      },
    });

    this.logger.log(`PDF regenerated for dossier: ${dossierId}`);

    return updated;
  }
}
