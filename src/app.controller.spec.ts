import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prismaService: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return healthy status when database is ok', async () => {
      const result = await appController.getHealth();
      expect(result.status).toBe('healthy');
      expect(result.services.database).toBe('ok');
    });

    it('should return unhealthy status when database fails', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('DB down'));
      const result = await appController.getHealth();
      expect(result.status).toBe('unhealthy');
      expect(result.services.database).toBe('error');
    });
  });
});
