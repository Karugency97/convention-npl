import { Test, TestingModule } from '@nestjs/testing';
import { SignatureService } from './signature.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DossierStatus } from '@prisma/client';
import * as crypto from 'crypto';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SignatureService', () => {
  let service: SignatureService;
  let prisma: {
    lettreMission: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    dossier: { update: jest.Mock };
    webhookEvent: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let storageService: {
    downloadFile: jest.Mock;
    uploadFile: jest.Mock;
    generateLettreMissionKey: jest.Mock;
  };

  const WEBHOOK_SECRET = 'test-webhook-secret';
  const API_KEY = 'test-api-key';
  const API_URL = 'https://firma.test.com';
  const APP_URL = 'https://app.test.com';

  const mockClient = {
    id: 'client-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockDossier = {
    id: 'dossier-1',
    reference: 'DOS-2026-001',
    status: DossierStatus.DRAFT,
    client: mockClient,
  };

  const mockLettreMission = {
    id: 'lm-1',
    dossierId: 'dossier-1',
    pdfUrl: 'lettres-mission/dossier-1/generated.pdf',
    signedPdfUrl: null,
    sentForSignatureAt: null,
    signedAt: null,
    firmaSignatureId: null,
    dossier: mockDossier,
  };

  function computeSignature(payload: object): string {
    return crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  beforeEach(async () => {
    prisma = {
      lettreMission: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      dossier: { update: jest.fn() },
      webhookEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    storageService = {
      downloadFile: jest.fn().mockResolvedValue(Buffer.from('pdf-content')),
      uploadFile: jest.fn().mockResolvedValue('key'),
      generateLettreMissionKey: jest.fn().mockReturnValue(
        'lettres-mission/dossier-1/signed.pdf',
      ),
    };

    const configGet = jest.fn().mockImplementation((key: string) => {
      const config: Record<string, string> = {
        FIRMA_API_KEY: API_KEY,
        FIRMA_API_URL: API_URL,
        FIRMA_WEBHOOK_SECRET: WEBHOOK_SECRET,
        APP_URL: APP_URL,
      };
      return config[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storageService },
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
      ],
    }).compile();

    service = module.get<SignatureService>(SignatureService);

    mockFetch.mockReset();
  });

  describe('sendForSignature', () => {
    it('should send a lettre de mission for signature', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(mockLettreMission);

      // Mock createSignatureRequest fetch call
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'sig-123',
              status: 'created',
            }),
        })
        // Mock sendSignatureRequest fetch call
        .mockResolvedValueOnce({
          ok: true,
        });

      prisma.$transaction.mockResolvedValue([]);

      const result = await service.sendForSignature('dossier-1');

      expect(result).toEqual({
        signatureId: 'sig-123',
        status: 'sent',
        message: 'Le client recevra un email avec le lien de signature',
      });
      expect(storageService.downloadFile).toHaveBeenCalledWith(
        'lettres-mission/dossier-1/generated.pdf',
      );
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when lettre de mission does not exist', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(null);

      await expect(
        service.sendForSignature('nonexistent'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.sendForSignature('nonexistent'),
      ).rejects.toThrow('Lettre de mission not found');
    });

    it('should throw BadRequestException when PDF is not generated', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue({
        ...mockLettreMission,
        pdfUrl: null,
      });

      await expect(
        service.sendForSignature('dossier-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendForSignature('dossier-1'),
      ).rejects.toThrow('PDF not generated');
    });

    it('should throw BadRequestException when already sent for signature', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue({
        ...mockLettreMission,
        sentForSignatureAt: new Date(),
      });

      await expect(
        service.sendForSignature('dossier-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendForSignature('dossier-1'),
      ).rejects.toThrow('Already sent for signature');
    });

    it('should throw BadRequestException when dossier is not in DRAFT status', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue({
        ...mockLettreMission,
        dossier: { ...mockDossier, status: DossierStatus.SIGNED },
      });

      await expect(
        service.sendForSignature('dossier-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendForSignature('dossier-1'),
      ).rejects.toThrow(
        'Dossier must be in DRAFT status to send for signature',
      );
    });

    it('should throw BadRequestException when Firma API returns an error', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(mockLettreMission);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('API Error'),
      });

      await expect(
        service.sendForSignature('dossier-1'),
      ).rejects.toThrow('Failed to create signature request');
    });

    it('should throw BadRequestException when send request fails', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(mockLettreMission);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'sig-123', status: 'created' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve('Send failed'),
        });

      await expect(
        service.sendForSignature('dossier-1'),
      ).rejects.toThrow('Failed to send signature request');
    });
  });

  describe('handleWebhook', () => {
    describe('signature verification', () => {
      it('should throw BadRequestException when signature is invalid', async () => {
        const payload = {
          event_id: 'evt-1',
          event_type: 'signing_request.completed',
          timestamp: '2026-01-15T10:00:00Z',
          data: { signing_request_id: 'sig-123' },
        };

        await expect(
          service.handleWebhook(payload, 'invalid-signature'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should accept a valid HMAC-SHA256 signature', async () => {
        const payload = {
          event_id: 'evt-1',
          event_type: 'unknown_event',
          timestamp: '2026-01-15T10:00:00Z',
          data: { signing_request_id: 'sig-123' },
        };
        const signature = computeSignature(payload);

        prisma.webhookEvent.findFirst.mockResolvedValue(null);
        prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-1' });
        prisma.webhookEvent.update.mockResolvedValue({});

        const result = await service.handleWebhook(payload, signature);

        expect(result).toEqual({ status: 'processed' });
      });
    });

    describe('idempotency', () => {
      it('should return already_processed for duplicate events', async () => {
        const payload = {
          event_id: 'evt-1',
          event_type: 'signing_request.completed',
          timestamp: '2026-01-15T10:00:00Z',
          data: { signing_request_id: 'sig-123' },
        };
        const signature = computeSignature(payload);

        prisma.webhookEvent.findFirst.mockResolvedValue({
          id: 'wh-existing',
          processed: true,
        });

        const result = await service.handleWebhook(payload, signature);

        expect(result).toEqual({ status: 'already_processed' });
        expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
      });
    });

    describe('signing_request.completed', () => {
      it('should update lettre de mission and dossier status to SIGNED', async () => {
        const payload = {
          event_id: 'evt-1',
          event_type: 'signing_request.completed',
          timestamp: '2026-01-15T10:00:00Z',
          data: {
            signing_request_id: 'sig-123',
            final_document_download_url: 'https://firma.test.com/docs/signed.pdf',
          },
        };
        const signature = computeSignature(payload);

        prisma.webhookEvent.findFirst.mockResolvedValue(null);
        prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-1' });
        prisma.lettreMission.findUnique.mockResolvedValue({
          ...mockLettreMission,
          firmaSignatureId: 'sig-123',
        });
        prisma.$transaction.mockResolvedValue([]);
        prisma.webhookEvent.update.mockResolvedValue({});

        // Mock download of signed document
        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () =>
            Promise.resolve(new ArrayBuffer(10)),
        });

        const result = await service.handleWebhook(payload, signature);

        expect(result).toEqual({ status: 'processed' });
        expect(storageService.uploadFile).toHaveBeenCalledWith(
          'lettres-mission/dossier-1/signed.pdf',
          expect.any(Buffer),
          'application/pdf',
        );
        expect(prisma.$transaction).toHaveBeenCalled();
        expect(prisma.lettreMission.update).toHaveBeenCalledWith({
          where: { id: 'lm-1' },
          data: {
            signedAt: expect.any(Date),
            signedPdfUrl: 'lettres-mission/dossier-1/signed.pdf',
          },
        });
        expect(prisma.dossier.update).toHaveBeenCalledWith({
          where: { id: 'dossier-1' },
          data: { status: DossierStatus.SIGNED },
        });
      });

      it('should handle completed event without download URL', async () => {
        const payload = {
          event_id: 'evt-2',
          event_type: 'signing_request.completed',
          timestamp: '2026-01-15T10:00:00Z',
          data: {
            signing_request_id: 'sig-123',
          },
        };
        const signature = computeSignature(payload);

        prisma.webhookEvent.findFirst.mockResolvedValue(null);
        prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-2' });
        prisma.lettreMission.findUnique.mockResolvedValue({
          ...mockLettreMission,
          firmaSignatureId: 'sig-123',
        });
        prisma.$transaction.mockResolvedValue([]);
        prisma.webhookEvent.update.mockResolvedValue({});

        const result = await service.handleWebhook(payload, signature);

        expect(result).toEqual({ status: 'processed' });
        expect(storageService.uploadFile).not.toHaveBeenCalled();
        expect(prisma.lettreMission.update).toHaveBeenCalledWith({
          where: { id: 'lm-1' },
          data: {
            signedAt: expect.any(Date),
            signedPdfUrl: null,
          },
        });
      });

      it('should throw NotFoundException when lettre de mission not found for signature', async () => {
        const payload = {
          event_id: 'evt-3',
          event_type: 'signing_request.completed',
          timestamp: '2026-01-15T10:00:00Z',
          data: { signing_request_id: 'sig-unknown' },
        };
        const signature = computeSignature(payload);

        prisma.webhookEvent.findFirst.mockResolvedValue(null);
        prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-3' });
        prisma.lettreMission.findUnique.mockResolvedValue(null);
        prisma.webhookEvent.update.mockResolvedValue({});

        await expect(
          service.handleWebhook(payload, signature),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('signing_request.cancelled', () => {
      it('should set dossier status to CANCELLED', async () => {
        const payload = {
          event_id: 'evt-4',
          event_type: 'signing_request.cancelled',
          timestamp: '2026-01-15T10:00:00Z',
          data: { signing_request_id: 'sig-123' },
        };
        const signature = computeSignature(payload);

        prisma.webhookEvent.findFirst.mockResolvedValue(null);
        prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-4' });
        prisma.lettreMission.findUnique.mockResolvedValue({
          ...mockLettreMission,
          firmaSignatureId: 'sig-123',
        });
        prisma.dossier.update.mockResolvedValue({});
        prisma.webhookEvent.update.mockResolvedValue({});

        const result = await service.handleWebhook(payload, signature);

        expect(result).toEqual({ status: 'processed' });
        expect(prisma.dossier.update).toHaveBeenCalledWith({
          where: { id: 'dossier-1' },
          data: { status: DossierStatus.CANCELLED },
        });
      });

      it('should throw NotFoundException when lettre de mission not found', async () => {
        const payload = {
          event_id: 'evt-5',
          event_type: 'signing_request.cancelled',
          timestamp: '2026-01-15T10:00:00Z',
          data: { signing_request_id: 'sig-unknown' },
        };
        const signature = computeSignature(payload);

        prisma.webhookEvent.findFirst.mockResolvedValue(null);
        prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-5' });
        prisma.lettreMission.findUnique.mockResolvedValue(null);
        prisma.webhookEvent.update.mockResolvedValue({});

        await expect(
          service.handleWebhook(payload, signature),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('signing_request.expired', () => {
      it('should reset lettre de mission and revert dossier to DRAFT', async () => {
        const payload = {
          event_id: 'evt-6',
          event_type: 'signing_request.expired',
          timestamp: '2026-01-15T10:00:00Z',
          data: { signing_request_id: 'sig-123' },
        };
        const signature = computeSignature(payload);

        prisma.webhookEvent.findFirst.mockResolvedValue(null);
        prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-6' });
        prisma.lettreMission.findUnique.mockResolvedValue({
          ...mockLettreMission,
          firmaSignatureId: 'sig-123',
        });
        prisma.$transaction.mockResolvedValue([]);
        prisma.webhookEvent.update.mockResolvedValue({});

        const result = await service.handleWebhook(payload, signature);

        expect(result).toEqual({ status: 'processed' });
        expect(prisma.lettreMission.update).toHaveBeenCalledWith({
          where: { id: 'lm-1' },
          data: {
            firmaSignatureId: null,
            sentForSignatureAt: null,
          },
        });
        expect(prisma.dossier.update).toHaveBeenCalledWith({
          where: { id: 'dossier-1' },
          data: { status: DossierStatus.DRAFT },
        });
      });
    });

    describe('error handling', () => {
      it('should save error message in webhook event when processing fails', async () => {
        const payload = {
          event_id: 'evt-7',
          event_type: 'signing_request.completed',
          timestamp: '2026-01-15T10:00:00Z',
          data: { signing_request_id: 'sig-unknown' },
        };
        const signature = computeSignature(payload);

        prisma.webhookEvent.findFirst.mockResolvedValue(null);
        prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-7' });
        prisma.lettreMission.findUnique.mockResolvedValue(null);
        prisma.webhookEvent.update.mockResolvedValue({});

        await expect(
          service.handleWebhook(payload, signature),
        ).rejects.toThrow();

        expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
          where: { id: 'wh-7' },
          data: { error: expect.any(String) },
        });
      });
    });
  });

  describe('getSignatureStatus', () => {
    it('should return signature status for a dossier', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue({
        ...mockLettreMission,
        firmaSignatureId: 'sig-123',
        sentForSignatureAt: new Date('2026-01-10'),
        signedAt: new Date('2026-01-12'),
        signedPdfUrl: 'lettres-mission/dossier-1/signed.pdf',
        dossier: {
          ...mockDossier,
          status: DossierStatus.SIGNED,
        },
      });

      const result = await service.getSignatureStatus('dossier-1');

      expect(result).toEqual({
        dossierId: 'dossier-1',
        status: DossierStatus.SIGNED,
        firmaSignatureId: 'sig-123',
        sentForSignatureAt: expect.any(Date),
        signedAt: expect.any(Date),
        hasSignedPdf: true,
      });
    });

    it('should return hasSignedPdf false when no signed PDF exists', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue({
        ...mockLettreMission,
        dossier: mockDossier,
      });

      const result = await service.getSignatureStatus('dossier-1');

      expect(result.hasSignedPdf).toBe(false);
      expect(result.firmaSignatureId).toBeNull();
      expect(result.sentForSignatureAt).toBeNull();
    });

    it('should throw NotFoundException when lettre de mission does not exist', async () => {
      prisma.lettreMission.findUnique.mockResolvedValue(null);

      await expect(
        service.getSignatureStatus('nonexistent'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getSignatureStatus('nonexistent'),
      ).rejects.toThrow('Lettre de mission not found');
    });
  });
});
