import { Test, TestingModule } from '@nestjs/testing';
import { ChequesService } from './cheques.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ChequeStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('ChequesService', () => {
  let service: ChequesService;
  let prisma: {
    cheque: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    dossier: { findUnique: jest.Mock };
  };

  const mockCheque = {
    id: 'cheque-1',
    paiementId: 'paiement-1',
    numero: 1,
    montant: new Decimal(500),
    dateEncaissementPrevue: new Date('2026-03-01'),
    status: ChequeStatus.ATTENDU,
    dateRecu: null,
    dateEncaisse: null,
    paiement: {
      id: 'paiement-1',
      dossierId: 'dossier-1',
      dossier: {
        id: 'dossier-1',
        reference: 'DOS-2026-001',
      },
    },
  };

  beforeEach(async () => {
    prisma = {
      cheque: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      dossier: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChequesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ChequesService>(ChequesService);
  });

  describe('updateStatus', () => {
    it('should update status from ATTENDU to RECU', async () => {
      prisma.cheque.findUnique.mockResolvedValue(mockCheque);
      const updatedCheque = {
        ...mockCheque,
        status: ChequeStatus.RECU,
        dateRecu: new Date(),
      };
      prisma.cheque.update.mockResolvedValue(updatedCheque);

      const result = await service.updateStatus(
        'cheque-1',
        ChequeStatus.RECU,
      );

      expect(result.status).toBe(ChequeStatus.RECU);
      expect(prisma.cheque.update).toHaveBeenCalledWith({
        where: { id: 'cheque-1' },
        data: expect.objectContaining({
          status: ChequeStatus.RECU,
          dateRecu: expect.any(Date),
        }),
        include: { paiement: true },
      });
    });

    it('should update status from ATTENDU to ENCAISSE and set both dates', async () => {
      prisma.cheque.findUnique.mockResolvedValue(mockCheque);
      prisma.cheque.update.mockResolvedValue({
        ...mockCheque,
        status: ChequeStatus.ENCAISSE,
      });

      await service.updateStatus('cheque-1', ChequeStatus.ENCAISSE);

      expect(prisma.cheque.update).toHaveBeenCalledWith({
        where: { id: 'cheque-1' },
        data: expect.objectContaining({
          status: ChequeStatus.ENCAISSE,
          dateEncaisse: expect.any(Date),
          dateRecu: expect.any(Date),
        }),
        include: { paiement: true },
      });
    });

    it('should update status from RECU to ENCAISSE', async () => {
      const recuCheque = {
        ...mockCheque,
        status: ChequeStatus.RECU,
        dateRecu: new Date('2026-02-15'),
      };
      prisma.cheque.findUnique.mockResolvedValue(recuCheque);
      prisma.cheque.update.mockResolvedValue({
        ...recuCheque,
        status: ChequeStatus.ENCAISSE,
      });

      await service.updateStatus('cheque-1', ChequeStatus.ENCAISSE);

      // dateRecu already set, should not be overwritten
      const updateCall = prisma.cheque.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(ChequeStatus.ENCAISSE);
      expect(updateCall.data.dateEncaisse).toEqual(expect.any(Date));
      expect(updateCall.data.dateRecu).toBeUndefined();
    });

    it('should not overwrite existing dateRecu when transitioning to RECU', async () => {
      const chequeWithDateRecu = {
        ...mockCheque,
        status: ChequeStatus.ATTENDU,
        dateRecu: new Date('2026-02-10'),
      };
      prisma.cheque.findUnique.mockResolvedValue(chequeWithDateRecu);
      prisma.cheque.update.mockResolvedValue({
        ...chequeWithDateRecu,
        status: ChequeStatus.RECU,
      });

      await service.updateStatus('cheque-1', ChequeStatus.RECU);

      const updateCall = prisma.cheque.update.mock.calls[0][0];
      // dateRecu already exists, should not be in update data
      expect(updateCall.data.dateRecu).toBeUndefined();
    });

    it('should throw NotFoundException when cheque does not exist', async () => {
      prisma.cheque.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', ChequeStatus.RECU),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateStatus('nonexistent', ChequeStatus.RECU),
      ).rejects.toThrow('Cheque not found');
    });

    it('should throw BadRequestException for invalid transition ENCAISSE to RECU', async () => {
      const encaisseCheque = {
        ...mockCheque,
        status: ChequeStatus.ENCAISSE,
      };
      prisma.cheque.findUnique.mockResolvedValue(encaisseCheque);

      await expect(
        service.updateStatus('cheque-1', ChequeStatus.RECU),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus('cheque-1', ChequeStatus.RECU),
      ).rejects.toThrow('Invalid status transition');
    });

    it('should throw BadRequestException for invalid transition ENCAISSE to ATTENDU', async () => {
      const encaisseCheque = {
        ...mockCheque,
        status: ChequeStatus.ENCAISSE,
      };
      prisma.cheque.findUnique.mockResolvedValue(encaisseCheque);

      await expect(
        service.updateStatus('cheque-1', ChequeStatus.ATTENDU),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid transition RECU to ATTENDU', async () => {
      const recuCheque = {
        ...mockCheque,
        status: ChequeStatus.RECU,
      };
      prisma.cheque.findUnique.mockResolvedValue(recuCheque);

      await expect(
        service.updateStatus('cheque-1', ChequeStatus.ATTENDU),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for same status transition ATTENDU to ATTENDU', async () => {
      prisma.cheque.findUnique.mockResolvedValue(mockCheque);

      await expect(
        service.updateStatus('cheque-1', ChequeStatus.ATTENDU),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all cheques without filters', async () => {
      prisma.cheque.findMany.mockResolvedValue([mockCheque]);

      const result = await service.findAll();

      expect(result).toEqual([mockCheque]);
      expect(prisma.cheque.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          paiement: {
            include: {
              dossier: { include: { client: true } },
            },
          },
        },
        orderBy: [{ paiement: { createdAt: 'desc' } }, { numero: 'asc' }],
      });
    });

    it('should filter by paiementId', async () => {
      prisma.cheque.findMany.mockResolvedValue([mockCheque]);

      await service.findAll({ paiementId: 'paiement-1' });

      expect(prisma.cheque.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { paiementId: 'paiement-1' },
        }),
      );
    });

    it('should filter by status', async () => {
      prisma.cheque.findMany.mockResolvedValue([]);

      await service.findAll({ status: ChequeStatus.RECU });

      expect(prisma.cheque.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ChequeStatus.RECU },
        }),
      );
    });

    it('should filter by dossierId through paiement relation', async () => {
      prisma.cheque.findMany.mockResolvedValue([]);

      await service.findAll({ dossierId: 'dossier-1' });

      expect(prisma.cheque.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { paiement: { dossierId: 'dossier-1' } },
        }),
      );
    });

    it('should combine multiple filters', async () => {
      prisma.cheque.findMany.mockResolvedValue([]);

      await service.findAll({
        paiementId: 'paiement-1',
        status: ChequeStatus.ATTENDU,
      });

      expect(prisma.cheque.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            paiementId: 'paiement-1',
            status: ChequeStatus.ATTENDU,
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a cheque with paiement and dossier relations', async () => {
      prisma.cheque.findUnique.mockResolvedValue(mockCheque);

      const result = await service.findOne('cheque-1');

      expect(result).toEqual(mockCheque);
      expect(prisma.cheque.findUnique).toHaveBeenCalledWith({
        where: { id: 'cheque-1' },
        include: {
          paiement: {
            include: {
              dossier: { include: { client: true } },
            },
          },
        },
      });
    });

    it('should throw NotFoundException when cheque does not exist', async () => {
      prisma.cheque.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Cheque not found',
      );
    });
  });

  describe('getChequesByDossier', () => {
    it('should return cheques grouped by dossier with summary', async () => {
      const dossierWithPaiements = {
        id: 'dossier-1',
        paiements: [
          {
            cheques: [
              { ...mockCheque, status: ChequeStatus.ATTENDU },
              {
                ...mockCheque,
                id: 'cheque-2',
                numero: 2,
                status: ChequeStatus.RECU,
              },
              {
                ...mockCheque,
                id: 'cheque-3',
                numero: 3,
                status: ChequeStatus.ENCAISSE,
              },
            ],
          },
        ],
      };
      prisma.dossier.findUnique.mockResolvedValue(dossierWithPaiements);

      const result = await service.getChequesByDossier('dossier-1');

      expect(result.dossierId).toBe('dossier-1');
      expect(result.totalCheques).toBe(3);
      expect(result.summary).toEqual({
        attendu: 1,
        recu: 1,
        encaisse: 1,
      });
    });

    it('should return empty summary when no cheques exist', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'dossier-1',
        paiements: [],
      });

      const result = await service.getChequesByDossier('dossier-1');

      expect(result.totalCheques).toBe(0);
      expect(result.summary).toEqual({
        attendu: 0,
        recu: 0,
        encaisse: 0,
      });
    });

    it('should flatten cheques from multiple paiements', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'dossier-1',
        paiements: [
          {
            cheques: [
              { ...mockCheque, status: ChequeStatus.ATTENDU },
            ],
          },
          {
            cheques: [
              {
                ...mockCheque,
                id: 'cheque-4',
                status: ChequeStatus.ENCAISSE,
              },
            ],
          },
        ],
      });

      const result = await service.getChequesByDossier('dossier-1');

      expect(result.totalCheques).toBe(2);
    });

    it('should throw NotFoundException when dossier does not exist', async () => {
      prisma.dossier.findUnique.mockResolvedValue(null);

      await expect(
        service.getChequesByDossier('nonexistent'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getChequesByDossier('nonexistent'),
      ).rejects.toThrow('Dossier not found');
    });
  });
});
