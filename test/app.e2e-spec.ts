import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { PrismaService } from '../src/prisma/prisma.service';

class MockPrismaService {
  $queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const API_KEY = 'test-api-key-12345';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              PORT: 3001,
              API_KEY,
            }),
          ],
        }),
      ],
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useClass: MockPrismaService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    const configService = moduleFixture.get<ConfigService>(ConfigService);
    const reflector = moduleFixture.get<Reflector>(Reflector);
    app.useGlobalGuards(new ApiKeyGuard(configService, reflector));

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Health Check', () => {
    it('/ (GET) should be public and return greeting', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });

    it('/health (GET) should be public and return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services.database).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
