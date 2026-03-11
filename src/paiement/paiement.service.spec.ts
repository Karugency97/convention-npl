import { Test, TestingModule } from '@nestjs/testing';
import { PaiementService } from './paiement.service';
import { PrismaService } from '../prisma/prisma.service';
import { PayPlugService } from './payplug.service';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  DossierStatus,
  PaiementMode,
  PaiementStatus,
  ChequeStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('PaiementService', () => {
  let service: PaiementService;
  let prisma: {
    dossier: { findUnique: jest.Mock; update: jest.Mock };
    paiement: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    webhookEvent: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let payplugService: {
    createPayment: jest.Mock;
    verifyWebhookSignature: jest.Mock;
  };

  const mockClient = {
    id: 'client-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockLettreMission = {
    totalAmount: new Decimal(1500),
  };

  const mockDossier = {
    id: 'dossier-1',
    reference: 'DOS-2026-001',
    status: DossierStatus.SIGNED,
    client: mockClient,
    lettreMission: mockLettreMission,
    paiements: [],
  };

  const mockPaiement = {
    id: 'paiement-1',
    dossierId: 'dossier-1',
    mode: PaiementMode.PAYPLUG,
    status: PaiementStatus.PENDING,
    amount: new Decimal(1500),
    payplugPaymentId: null,
    payplugUrl: null,
    paidAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      dossier: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      paiement: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      webhookEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    payplugService = {
      createPayment: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaiementService,
        { provide: PrismaService, useValue: prisma },
        { provide: PayPlugService, useValue: payplugService },
      ],
    }).compile();

    service = module.get<PaiementService>(PaiementService);
  });

  describe('choosePaiement', () => {
    describe('common validation', () => {
      it('should throw NotFoundException when dossier does not exist', async () => {
        prisma.dossier.findUnique.mockResolvedValue(null);

        await expect(
          service.choosePaiement('nonexistent', {
            mode: PaiementMode.PAYPLUG,
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException when dossier is not SIGNED', async () => {
        prisma.dossier.findUnique.mockResolvedValue({
          ...mockDossier,
          status: DossierStatus.DRAFT,
        });

        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.PAYPLUG,
          }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.PAYPLUG,
          }),
        ).rejects.toThrow('Payment can only be chosen after signature');
      });

      it('should throw BadRequestException when lettre de mission is missing', async () => {
        prisma.dossier.findUnique.mockResolvedValue({
          ...mockDossier,
          lettreMission: null,
        });

        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.PAYPLUG,
          }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.PAYPLUG,
          }),
        ).rejects.toThrow('Lettre de mission not found');
      });

      it('should throw BadRequestException when a PENDING payment already exists', async () => {
        prisma.dossier.findUnique.mockResolvedValue({
          ...mockDossier,
          paiements: [
            { ...mockPaiement, status: PaiementStatus.PENDING },
          ],
        });

        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.PAYPLUG,
          }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.PAYPLUG,
          }),
        ).rejects.toThrow('Payment already initiated for this dossier');
      });

      it('should throw BadRequestException when a COMPLETED payment already exists', async () => {
        prisma.dossier.findUnique.mockResolvedValue({
          ...mockDossier,
          paiements: [
            { ...mockPaiement, status: PaiementStatus.COMPLETED },
          ],
        });

        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.PAYPLUG,
          }),
        ).rejects.toThrow('Payment already initiated for this dossier');
      });

      it('should allow new payment when only FAILED payments exist', async () => {
        prisma.dossier.findUnique.mockResolvedValue({
          ...mockDossier,
          paiements: [
            { ...mockPaiement, status: PaiementStatus.FAILED },
          ],
        });
        prisma.paiement.create.mockResolvedValue(mockPaiement);
        payplugService.createPayment.mockResolvedValue({
          paymentId: 'pp-1',
          paymentUrl: 'https://payplug.com/pay',
        });
        prisma.$transaction.mockImplementation(async (fn) => {
          if (typeof fn === 'function') {
            return fn({
              paiement: prisma.paiement,
              dossier: prisma.dossier,
            });
          }
          return fn;
        });
        prisma.paiement.update.mockResolvedValue({
          ...mockPaiement,
          payplugPaymentId: 'pp-1',
        });

        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.PAYPLUG,
          }),
        ).resolves.toBeDefined();
      });
    });

    describe('CHEQUES mode', () => {
      const chequeDto = {
        mode: PaiementMode.CHEQUES,
        cheques: [
          { montant: 750, dateEncaissementPrevue: '2026-02-01' },
          { montant: 750, dateEncaissementPrevue: '2026-03-01' },
        ],
      };

      it('should create a cheque payment with correct amounts', async () => {
        prisma.dossier.findUnique.mockResolvedValue(mockDossier);
        const mockCreatedPaiement = {
          ...mockPaiement,
          mode: PaiementMode.CHEQUES,
          status: PaiementStatus.COMPLETED,
          cheques: [
            { id: 'c1', numero: 1, montant: new Decimal(750), status: ChequeStatus.ATTENDU },
            { id: 'c2', numero: 2, montant: new Decimal(750), status: ChequeStatus.ATTENDU },
          ],
        };
        prisma.$transaction.mockImplementation(async (fn) => {
          if (typeof fn === 'function') {
            const tx = {
              paiement: {
                create: jest.fn().mockResolvedValue(mockCreatedPaiement),
              },
              dossier: {
                update: jest.fn().mockResolvedValue({}),
              },
            };
            return fn(tx);
          }
          return fn;
        });

        const result = await service.choosePaiement('dossier-1', chequeDto);

        expect(result.message).toBe(
          'Paiement par chèques enregistré avec succès',
        );
        expect(result.paiement).toBeDefined();
      });

      it('should throw BadRequestException when cheques array is empty', async () => {
        prisma.dossier.findUnique.mockResolvedValue(mockDossier);

        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.CHEQUES,
            cheques: [],
          }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.CHEQUES,
            cheques: [],
          }),
        ).rejects.toThrow('Cheques are required for CHEQUES mode');
      });

      it('should throw BadRequestException when cheques are not provided', async () => {
        prisma.dossier.findUnique.mockResolvedValue(mockDossier);

        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.CHEQUES,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when cheques total does not match amount', async () => {
        prisma.dossier.findUnique.mockResolvedValue(mockDossier);

        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.CHEQUES,
            cheques: [
              { montant: 500, dateEncaissementPrevue: '2026-02-01' },
              { montant: 500, dateEncaissementPrevue: '2026-03-01' },
            ],
          }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.CHEQUES,
            cheques: [
              { montant: 500, dateEncaissementPrevue: '2026-02-01' },
            ],
          }),
        ).rejects.toThrow('Total of cheques');
      });

      it('should accept cheques within 0.01 tolerance', async () => {
        prisma.dossier.findUnique.mockResolvedValue(mockDossier);
        prisma.$transaction.mockImplementation(async (fn) => {
          if (typeof fn === 'function') {
            const tx = {
              paiement: {
                create: jest.fn().mockResolvedValue({
                  ...mockPaiement,
                  mode: PaiementMode.CHEQUES,
                  cheques: [],
                }),
              },
              dossier: { update: jest.fn() },
            };
            return fn(tx);
          }
          return fn;
        });

        // 1500.005 rounds within 0.01 of 1500
        await expect(
          service.choosePaiement('dossier-1', {
            mode: PaiementMode.CHEQUES,
            cheques: [
              { montant: 1500.005, dateEncaissementPrevue: '2026-02-01' },
            ],
          }),
        ).resolves.toBeDefined();
      });
    });

    describe('PAYPLUG mode', () => {
      it('should create a PayPlug payment and return payment URL', async () => {
        prisma.dossier.findUnique.mockResolvedValue(mockDossier);
        prisma.paiement.create.mockResolvedValue(mockPaiement);
        payplugService.createPayment.mockResolvedValue({
          paymentId: 'pp-123',
          paymentUrl: 'https://payplug.com/pay/pp-123',
        });
        const updatedPaiement = {
          ...mockPaiement,
          payplugPaymentId: 'pp-123',
          payplugUrl: 'https://payplug.com/pay/pp-123',
        };
        prisma.$transaction.mockImplementation(async (fn) => {
          if (typeof fn === 'function') {
            return fn({
              paiement: {
                update: jest.fn().mockResolvedValue(updatedPaiement),
              },
              dossier: { update: jest.fn() },
            });
          }
          return fn;
        });

        const result = await service.choosePaiement('dossier-1', {
          mode: PaiementMode.PAYPLUG,
        });

        expect(result.paymentUrl).toBe('https://payplug.com/pay/pp-123');
        expect(result.message).toBe(
          'Redirection vers la page de paiement',
        );
        expect(payplugService.createPayment).toHaveBeenCalledWith(
          150000, // 1500 * 100 cents
          expect.objectContaining({
            dossierId: 'dossier-1',
            paiementId: 'paiement-1',
            reference: 'DOS-2026-001',
          }),
          expect.objectContaining({
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe',
          }),
        );
      });
    });
  });

  describe('handlePayPlugWebhook', () => {
    const successPayload = {
      event: 'payment.succeeded',
      data: {
        id: 'pp-123',
        metadata: { paiementId: 'paiement-1', dossierId: 'dossier-1' },
      },
    };

    it('should throw BadRequestException when signature is invalid', async () => {
      payplugService.verifyWebhookSignature.mockReturnValue(false);

      await expect(
        service.handlePayPlugWebhook(successPayload, 'raw-body', 'bad-sig'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.handlePayPlugWebhook(successPayload, 'raw-body', 'bad-sig'),
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should return already_processed for duplicate events', async () => {
      payplugService.verifyWebhookSignature.mockReturnValue(true);
      prisma.webhookEvent.findFirst.mockResolvedValue({
        id: 'wh-1',
        processed: true,
      });

      const result = await service.handlePayPlugWebhook(
        successPayload,
        'raw-body',
        'valid-sig',
      );

      expect(result).toEqual({ status: 'already_processed' });
    });

    it('should process payment.succeeded and update status to PAID', async () => {
      payplugService.verifyWebhookSignature.mockReturnValue(true);
      prisma.webhookEvent.findFirst.mockResolvedValue(null);
      prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-1' });
      prisma.paiement.findUnique.mockResolvedValue({
        ...mockPaiement,
        payplugPaymentId: 'pp-123',
        dossierId: 'dossier-1',
        dossier: mockDossier,
      });
      prisma.$transaction.mockResolvedValue([]);
      prisma.webhookEvent.update.mockResolvedValue({});

      const result = await service.handlePayPlugWebhook(
        successPayload,
        'raw-body',
        'valid-sig',
      );

      expect(result).toEqual({ status: 'processed' });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.paiement.update).toHaveBeenCalledWith({
        where: { id: 'paiement-1' },
        data: {
          status: PaiementStatus.COMPLETED,
          paidAt: expect.any(Date),
        },
      });
      expect(prisma.dossier.update).toHaveBeenCalledWith({
        where: { id: 'dossier-1' },
        data: { status: DossierStatus.PAID },
      });
    });

    it('should process payment.failed and revert status to SIGNED', async () => {
      payplugService.verifyWebhookSignature.mockReturnValue(true);
      prisma.webhookEvent.findFirst.mockResolvedValue(null);
      prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-2' });
      prisma.paiement.findUnique.mockResolvedValue({
        ...mockPaiement,
        payplugPaymentId: 'pp-123',
        dossierId: 'dossier-1',
        dossier: mockDossier,
      });
      prisma.$transaction.mockResolvedValue([]);
      prisma.webhookEvent.update.mockResolvedValue({});

      const failPayload = {
        event: 'payment.failed',
        data: {
          id: 'pp-123',
          failure_code: 'card_declined',
        },
      };

      const result = await service.handlePayPlugWebhook(
        failPayload,
        'raw-body',
        'valid-sig',
      );

      expect(result).toEqual({ status: 'processed' });
      expect(prisma.paiement.update).toHaveBeenCalledWith({
        where: { id: 'paiement-1' },
        data: { status: PaiementStatus.FAILED },
      });
      expect(prisma.dossier.update).toHaveBeenCalledWith({
        where: { id: 'dossier-1' },
        data: { status: DossierStatus.SIGNED },
      });
    });

    it('should throw NotFoundException when paiement not found for succeeded event', async () => {
      payplugService.verifyWebhookSignature.mockReturnValue(true);
      prisma.webhookEvent.findFirst.mockResolvedValue(null);
      prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-3' });
      prisma.paiement.findUnique.mockResolvedValue(null);
      prisma.webhookEvent.update.mockResolvedValue({});

      await expect(
        service.handlePayPlugWebhook(successPayload, 'raw-body', 'valid-sig'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should save error message in webhook event when processing fails', async () => {
      payplugService.verifyWebhookSignature.mockReturnValue(true);
      prisma.webhookEvent.findFirst.mockResolvedValue(null);
      prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-4' });
      prisma.paiement.findUnique.mockResolvedValue(null);
      prisma.webhookEvent.update.mockResolvedValue({});

      await expect(
        service.handlePayPlugWebhook(successPayload, 'raw-body', 'valid-sig'),
      ).rejects.toThrow();

      expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'wh-4' },
        data: { error: expect.any(String) },
      });
    });

    it('should handle unknown event types gracefully', async () => {
      payplugService.verifyWebhookSignature.mockReturnValue(true);
      prisma.webhookEvent.findFirst.mockResolvedValue(null);
      prisma.webhookEvent.create.mockResolvedValue({ id: 'wh-5' });
      prisma.webhookEvent.update.mockResolvedValue({});

      const unknownPayload = {
        event: 'payment.unknown_event',
        data: { id: 'pp-999' },
      };

      const result = await service.handlePayPlugWebhook(
        unknownPayload,
        'raw-body',
        'valid-sig',
      );

      expect(result).toEqual({ status: 'processed' });
    });
  });

  describe('findOne', () => {
    it('should return a paiement with cheques and dossier', async () => {
      const paiementWithRelations = {
        ...mockPaiement,
        cheques: [],
        dossier: { ...mockDossier, client: mockClient },
      };
      prisma.paiement.findUnique.mockResolvedValue(paiementWithRelations);

      const result = await service.findOne('paiement-1');

      expect(result).toEqual(paiementWithRelations);
      expect(prisma.paiement.findUnique).toHaveBeenCalledWith({
        where: { id: 'paiement-1' },
        include: {
          cheques: { orderBy: { numero: 'asc' } },
          dossier: { include: { client: true } },
        },
      });
    });

    it('should throw NotFoundException when paiement does not exist', async () => {
      prisma.paiement.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Paiement not found',
      );
    });
  });

  describe('findByDossier', () => {
    it('should return paiements for a dossier', async () => {
      prisma.paiement.findMany.mockResolvedValue([mockPaiement]);

      const result = await service.findByDossier('dossier-1');

      expect(result).toEqual([mockPaiement]);
      expect(prisma.paiement.findMany).toHaveBeenCalledWith({
        where: { dossierId: 'dossier-1' },
        include: {
          cheques: { orderBy: { numero: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no paiements exist', async () => {
      prisma.paiement.findMany.mockResolvedValue([]);

      const result = await service.findByDossier('dossier-1');

      expect(result).toEqual([]);
    });
  });
});
