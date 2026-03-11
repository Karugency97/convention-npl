import { Test, TestingModule } from '@nestjs/testing';
import { DossiersService } from './dossiers.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DossierStatus } from '@prisma/client';

describe('DossiersService', () => {
  let service: DossiersService;
  let prisma: {
    client: { findUnique: jest.Mock };
    dossier: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockClient = {
    id: 'client-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockDossier = {
    id: 'dossier-1',
    reference: 'DOS-2026-001',
    clientId: 'client-1',
    description: 'Test case',
    status: DossierStatus.DRAFT,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    client: mockClient,
    lettreMission: null,
    paiements: [],
  };

  beforeEach(async () => {
    prisma = {
      client: {
        findUnique: jest.fn(),
      },
      dossier: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DossiersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DossiersService>(DossiersService);
  });

  describe('create', () => {
    const createDto = {
      clientId: 'client-1',
      description: 'Test case',
    };

    it('should create a dossier with a generated reference', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.dossier.findFirst.mockResolvedValue(null);
      prisma.dossier.create.mockResolvedValue(mockDossier);

      const result = await service.create(createDto);

      expect(result).toEqual(mockDossier);
      expect(prisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: 'client-1' },
      });
      expect(prisma.dossier.create).toHaveBeenCalledWith({
        data: {
          reference: expect.stringMatching(/^DOS-\d{4}-001$/),
          clientId: 'client-1',
          description: 'Test case',
        },
        include: { client: true },
      });
    });

    it('should increment reference number when previous dossiers exist', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.dossier.findFirst.mockResolvedValue({
        reference: `DOS-${new Date().getFullYear()}-005`,
      });
      prisma.dossier.create.mockResolvedValue({
        ...mockDossier,
        reference: `DOS-${new Date().getFullYear()}-006`,
      });

      await service.create(createDto);

      const createCall = prisma.dossier.create.mock.calls[0][0];
      expect(createCall.data.reference).toBe(
        `DOS-${new Date().getFullYear()}-006`,
      );
    });

    it('should throw NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Client not found',
      );
    });
  });

  describe('findAll', () => {
    it('should return all dossiers with relations', async () => {
      prisma.dossier.findMany.mockResolvedValue([mockDossier]);

      const result = await service.findAll();

      expect(result).toEqual([mockDossier]);
      expect(prisma.dossier.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          client: true,
          lettreMission: true,
          paiements: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by status', async () => {
      prisma.dossier.findMany.mockResolvedValue([mockDossier]);

      await service.findAll({ status: DossierStatus.DRAFT });

      expect(prisma.dossier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: DossierStatus.DRAFT },
        }),
      );
    });

    it('should filter by clientId', async () => {
      prisma.dossier.findMany.mockResolvedValue([mockDossier]);

      await service.findAll({ clientId: 'client-1' });

      expect(prisma.dossier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: 'client-1' },
        }),
      );
    });

    it('should combine status and clientId filters', async () => {
      prisma.dossier.findMany.mockResolvedValue([]);

      await service.findAll({
        status: DossierStatus.SIGNED,
        clientId: 'client-1',
      });

      expect(prisma.dossier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: DossierStatus.SIGNED,
            clientId: 'client-1',
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a dossier with all relations', async () => {
      prisma.dossier.findUnique.mockResolvedValue(mockDossier);

      const result = await service.findOne('dossier-1');

      expect(result).toEqual(mockDossier);
      expect(prisma.dossier.findUnique).toHaveBeenCalledWith({
        where: { id: 'dossier-1' },
        include: {
          client: true,
          lettreMission: true,
          paiements: {
            include: { cheques: true },
          },
        },
      });
    });

    it('should throw NotFoundException when dossier does not exist', async () => {
      prisma.dossier.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Dossier not found',
      );
    });
  });

  describe('update', () => {
    const updateDto = { description: 'Updated description' };

    it('should update a dossier successfully', async () => {
      const updatedDossier = {
        ...mockDossier,
        description: 'Updated description',
      };
      prisma.dossier.findUnique.mockResolvedValue(mockDossier);
      prisma.dossier.update.mockResolvedValue(updatedDossier);

      const result = await service.update('dossier-1', updateDto);

      expect(result).toEqual(updatedDossier);
      expect(prisma.dossier.update).toHaveBeenCalledWith({
        where: { id: 'dossier-1' },
        data: updateDto,
        include: {
          client: true,
          lettreMission: true,
          paiements: true,
        },
      });
    });

    it('should throw NotFoundException when dossier does not exist', async () => {
      prisma.dossier.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a DRAFT dossier successfully', async () => {
      prisma.dossier.findUnique.mockResolvedValue(mockDossier);
      prisma.dossier.delete.mockResolvedValue(mockDossier);

      const result = await service.remove('dossier-1');

      expect(result).toEqual(mockDossier);
      expect(prisma.dossier.delete).toHaveBeenCalledWith({
        where: { id: 'dossier-1' },
      });
    });

    it('should throw BadRequestException when dossier is not in DRAFT status', async () => {
      const sentDossier = {
        ...mockDossier,
        status: DossierStatus.SENT,
      };
      prisma.dossier.findUnique.mockResolvedValue(sentDossier);

      await expect(service.remove('dossier-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.remove('dossier-1')).rejects.toThrow(
        'Only DRAFT dossiers can be deleted',
      );
    });

    it('should throw BadRequestException when dossier is SIGNED', async () => {
      const signedDossier = {
        ...mockDossier,
        status: DossierStatus.SIGNED,
      };
      prisma.dossier.findUnique.mockResolvedValue(signedDossier);

      await expect(service.remove('dossier-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when dossier does not exist', async () => {
      prisma.dossier.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateReference (private, tested via create)', () => {
    it('should generate DOS-YYYY-001 when no dossiers exist for the year', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.dossier.findFirst.mockResolvedValue(null);
      prisma.dossier.create.mockResolvedValue(mockDossier);

      await service.create({ clientId: 'client-1', description: 'test' });

      const year = new Date().getFullYear();
      const createCall = prisma.dossier.create.mock.calls[0][0];
      expect(createCall.data.reference).toBe(`DOS-${year}-001`);
    });

    it('should pad reference numbers to 3 digits', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.dossier.findFirst.mockResolvedValue({
        reference: `DOS-${new Date().getFullYear()}-009`,
      });
      prisma.dossier.create.mockResolvedValue(mockDossier);

      await service.create({ clientId: 'client-1', description: 'test' });

      const year = new Date().getFullYear();
      const createCall = prisma.dossier.create.mock.calls[0][0];
      expect(createCall.data.reference).toBe(`DOS-${year}-010`);
    });

    it('should query dossiers with the current year prefix', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.dossier.findFirst.mockResolvedValue(null);
      prisma.dossier.create.mockResolvedValue(mockDossier);

      await service.create({ clientId: 'client-1', description: 'test' });

      const year = new Date().getFullYear();
      expect(prisma.dossier.findFirst).toHaveBeenCalledWith({
        where: {
          reference: { startsWith: `DOS-${year}-` },
        },
        orderBy: { reference: 'desc' },
      });
    });
  });
});
