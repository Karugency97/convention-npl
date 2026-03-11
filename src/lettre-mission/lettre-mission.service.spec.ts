import { Test, TestingModule } from '@nestjs/testing';
import { LettreMissionService } from './lettre-mission.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('LettreMissionService', () => {
  let service: LettreMissionService;
  let prisma: {
    dossier: { findUnique: jest.Mock };
    lettreMission: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let storageService: {
    uploadFile: jest.Mock;
    generateLettreMissionKey: jest.Mock;
    getSignedDownloadUrl: jest.Mock;
  };
  let pdfGeneratorService: {
    generateLettreMissionPdf: jest.Mock;
    formatDate: jest.Mock;
    formatAmount: jest.Mock;
  };

  const mockClient = {
    id: 'client-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+33612345678',
    address: '1 rue de Paris',
  };

  const mockDossier = {
    id: 'dossier-1',
    reference: 'DOS-2026-001',
    clientId: 'client-1',
    status: 'DRAFT',
    client: mockClient,
    lettreMission: null,
  };

  const mockLettreMission = {
    id: 'lm-1',
    dossierId: 'dossier-1',
    templateData: { dossierReference: 'DOS-2026-001' },
    pdfUrl: 'lettres-mission/dossier-1/generated.pdf',
    pdfGeneratedAt: new Date('2026-01-15'),
    signedPdfUrl: null,
    sentForSignatureAt: null,
    signedAt: null,
    totalAmount: new Decimal(1500),
    dossier: { ...mockDossier, client: mockClient },
  };

  beforeEach(async () => {
    prisma = {
      dossier: { findUnique: jest.fn() },
      lettreMission: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    storageService = {
      uploadFile: jest.fn().mockResolvedValue('lettres-mission/dossier-1/generated.pdf'),
      generateLettreMissionKey: jest.fn().mockReturnValue('lettres-mission/dossier-1/generated.pdf'),
      getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed-url.example.com/doc.pdf'),
    };

    pdfGeneratorService = {
      generateLettreMissionPdf: jest.fn().mockResolvedValue(Buffer.from('pdf-content')),
      formatDate: jest.fn().mockReturnValue('15 janvier 2026'),
      formatAmount: jest.fn().mockReturnValue('1 500,00'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LettreMissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storageService },
        { provide: PdfGeneratorService, useValue: pdfGeneratorService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<LettreMissionService>(LettreMissionService);
  });

  describe('create', () => {
    const createDto = {
      missionDescription: 'Conseil juridique',
      totalAmount: 1500,
      honorairesDetails: 'Forfait conseil',
    };

    it('should create a lettre de mission with PDF generation and upload', async () => {
      prisma.dossier.findUnique.mockResolvedValue(mockDossier);
      prisma.lettreMission.create.mockResolvedValue(mockLettreMission);

      const result = await service.create('dossier-1', createDto);

      expect(result).toEqual(mockLettreMission);
      expect(pdfGeneratorService.generateLettreMissionPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          dossierReference: 'DOS-2026-001',
          clientFullName: 'John Doe',
          clientEmail: 'john@example.com',
          missionDescription: 'Conseil juridique',
          totalAmountFormatted: '1 500,00',
        }),
      );
      expect(storageService.generateLettreMissionKey).toHaveBeenCalledWith(
        'dossier-1',
        'generated',
      );
      expect(storageService.uploadFile).toHaveBeenCalledWith(
        'lettres-mission/dossier-1/generated.pdf',
        expect.any(Buffer),
        'application/pdf',
      );
      expect(prisma.lettreMission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dossierId: 'dossier-1',
            totalAmount: expect.any(Decimal),
          }),
        }),
      );
    });

    it('should throw NotFoundException when dossier does not exist', async () => {
      prisma.dossier.findUnique.mockResolvedValue(null);

      await expect(service.create('nonexistent', createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create('nonexistent', createDto)).rejects.toThrow(
        'Dossier not found',
      );
    });

    it('should throw BadRequestException when lettre de mission already exists', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        ...mockDossier,
        lettreMission: mockLettreMission,
      });

      await expect(service.create('dossier-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('dossier-1', createDto)).rejects.toThrow(
        'Lettre de mission already exists for this dossier',
      );
    });

    it('should throw BadRequestException when dossier is not in DRAFT status', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        ...mockDossier,
        status: 'SENT',
        lettreMission: null,
      });

      await expect(service.create('dossier-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('dossier-1', createDto)).rejects.toThrow(
        'Lettre de mission can only be created for DRAFT dossiers',
      );
    });

    it('should use "Adresse non renseignee" when client has no address', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        ...mockDossier,
        client: { ...mockClient, address: null },
      });
      prisma.lettreMission.create.mockResolvedValue(mockLettreMission);

      await service.create('dossier-1', createDto);

      expect(pdfGeneratorService.generateLettreMissionPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          clientAddress: 'Adresse non renseignée',
        }),
      );
    });
  });

  describe('findByDossierId', () => {
    it('should return the lettre de mission for a dossier', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(mockLettreMission);

      const result = await service.findByDossierId('dossier-1');

      expect(result).toEqual(mockLettreMission);
      expect(prisma.lettreMission.findUnique).toHaveBeenCalledWith({
        where: { dossierId: 'dossier-1' },
        include: {
          dossier: { include: { client: true } },
        },
      });
    });

    it('should throw NotFoundException when lettre de mission does not exist', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(null);

      await expect(service.findByDossierId('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByDossierId('nonexistent')).rejects.toThrow(
        'Lettre de mission not found',
      );
    });
  });

  describe('getPdfDownloadUrl', () => {
    it('should return a signed URL for the generated PDF', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(mockLettreMission);

      const result = await service.getPdfDownloadUrl('dossier-1');

      expect(result).toEqual({
        url: 'https://signed-url.example.com/doc.pdf',
        expiresIn: 3600,
      });
      expect(storageService.getSignedDownloadUrl).toHaveBeenCalledWith(
        'lettres-mission/dossier-1/generated.pdf',
        3600,
      );
    });

    it('should return a signed URL for the signed PDF when signed=true', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue({
        ...mockLettreMission,
        signedPdfUrl: 'lettres-mission/dossier-1/signed.pdf',
      });

      const result = await service.getPdfDownloadUrl('dossier-1', true);

      expect(result.url).toBe('https://signed-url.example.com/doc.pdf');
      expect(storageService.getSignedDownloadUrl).toHaveBeenCalledWith(
        'lettres-mission/dossier-1/signed.pdf',
        3600,
      );
    });

    it('should throw NotFoundException when signed PDF is requested but not available', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(mockLettreMission);

      await expect(
        service.getPdfDownloadUrl('dossier-1', true),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPdfDownloadUrl('dossier-1', true),
      ).rejects.toThrow('Signed PDF not available');
    });

    it('should throw NotFoundException when generated PDF URL is null', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue({
        ...mockLettreMission,
        pdfUrl: null,
      });

      await expect(
        service.getPdfDownloadUrl('dossier-1', false),
      ).rejects.toThrow('PDF not generated');
    });
  });

  describe('regeneratePdf', () => {
    it('should regenerate the PDF and update the record', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(mockLettreMission);
      prisma.lettreMission.update.mockResolvedValue({
        ...mockLettreMission,
        pdfGeneratedAt: new Date(),
      });

      const result = await service.regeneratePdf('dossier-1');

      expect(pdfGeneratorService.generateLettreMissionPdf).toHaveBeenCalled();
      expect(storageService.uploadFile).toHaveBeenCalled();
      expect(prisma.lettreMission.update).toHaveBeenCalledWith({
        where: { dossierId: 'dossier-1' },
        data: expect.objectContaining({
          pdfUrl: 'lettres-mission/dossier-1/generated.pdf',
          pdfGeneratedAt: expect.any(Date),
        }),
        include: {
          dossier: { include: { client: true } },
        },
      });
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when already sent for signature', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue({
        ...mockLettreMission,
        sentForSignatureAt: new Date('2026-01-20'),
      });

      await expect(service.regeneratePdf('dossier-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.regeneratePdf('dossier-1')).rejects.toThrow(
        'Cannot regenerate PDF after sending for signature',
      );
    });

    it('should throw NotFoundException when lettre de mission does not exist', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(null);

      await expect(service.regeneratePdf('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
