import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: {
    client: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockClient = {
    id: 'client-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+33612345678',
    address: '1 rue de Paris',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      client: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  describe('create', () => {
    const createDto = {
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+33612345678',
      address: '1 rue de Paris',
    };

    it('should create a client successfully', async () => {
      prisma.client.create.mockResolvedValue(mockClient);

      const result = await service.create(createDto);

      expect(result).toEqual(mockClient);
      expect(prisma.client.create).toHaveBeenCalledWith({ data: createDto });
    });

    it('should throw ConflictException when email already exists', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0' },
      );
      prisma.client.create.mockRejectedValue(prismaError);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'A client with this email already exists',
      );
    });

    it('should rethrow unknown Prisma errors', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Some other error',
        { code: 'P2003', clientVersion: '5.0.0' },
      );
      prisma.client.create.mockRejectedValue(prismaError);

      await expect(service.create(createDto)).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      );
    });

    it('should rethrow non-Prisma errors', async () => {
      prisma.client.create.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.create(createDto)).rejects.toThrow(
        'DB connection failed',
      );
    });
  });

  describe('findAll', () => {
    it('should return all clients ordered by createdAt desc', async () => {
      const clients = [mockClient, { ...mockClient, id: 'client-2' }];
      prisma.client.findMany.mockResolvedValue(clients);

      const result = await service.findAll();

      expect(result).toEqual(clients);
      expect(prisma.client.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return an empty array when no clients exist', async () => {
      prisma.client.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a client with dossiers when found', async () => {
      const clientWithDossiers = { ...mockClient, dossiers: [] };
      prisma.client.findUnique.mockResolvedValue(clientWithDossiers);

      const result = await service.findOne('client-1');

      expect(result).toEqual(clientWithDossiers);
      expect(prisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        include: { dossiers: true },
      });
    });

    it('should throw NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Client with ID nonexistent not found',
      );
    });
  });

  describe('update', () => {
    const updateDto = { firstName: 'Jane' };

    it('should update a client successfully', async () => {
      const updatedClient = { ...mockClient, firstName: 'Jane' };
      prisma.client.update.mockResolvedValue(updatedClient);

      const result = await service.update('client-1', updateDto);

      expect(result).toEqual(updatedClient);
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: updateDto,
      });
    });

    it('should throw ConflictException when updated email already exists', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0' },
      );
      prisma.client.update.mockRejectedValue(prismaError);

      await expect(
        service.update('client-1', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when client to update does not exist', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );
      prisma.client.update.mockRejectedValue(prismaError);

      await expect(
        service.update('nonexistent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rethrow unknown errors', async () => {
      prisma.client.update.mockRejectedValue(new Error('Unexpected'));

      await expect(
        service.update('client-1', updateDto),
      ).rejects.toThrow('Unexpected');
    });
  });

  describe('remove', () => {
    it('should delete a client successfully', async () => {
      prisma.client.delete.mockResolvedValue(mockClient);

      const result = await service.remove('client-1');

      expect(result).toEqual(mockClient);
      expect(prisma.client.delete).toHaveBeenCalledWith({
        where: { id: 'client-1' },
      });
    });

    it('should throw NotFoundException when client to delete does not exist', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );
      prisma.client.delete.mockRejectedValue(prismaError);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should rethrow unknown errors', async () => {
      prisma.client.delete.mockRejectedValue(new Error('Unexpected'));

      await expect(service.remove('client-1')).rejects.toThrow('Unexpected');
    });
  });
});
