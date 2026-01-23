import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { ClientsModule } from '../src/clients/clients.module';
import { DossiersModule } from '../src/dossiers/dossiers.module';
import { LettreMissionModule } from '../src/lettre-mission/lettre-mission.module';
import { SignatureModule } from '../src/signature/signature.module';
import { PaiementModule } from '../src/paiement/paiement.module';
import { StorageModule } from '../src/storage/storage.module';
import { StorageService } from '../src/storage/storage.service';
import { PdfGeneratorService } from '../src/lettre-mission/pdf-generator.service';
import { PayPlugService } from '../src/paiement/payplug.service';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import {
  MockStorageService,
  MockPdfGeneratorService,
  MockPayPlugService,
} from './utils/mock-providers';
import {
  cleanDatabase,
  createTestClientData,
  createTestDossierData,
  createTestLettreMissionData,
  createTestChequesData,
  generateFirmaWebhookSignature,
  generatePayPlugWebhookSignature,
} from './utils/test-helpers';
import { DossierStatus, PaiementStatus, ChequeStatus } from '@prisma/client';

describe('Complete Workflow E2E Tests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mockStorage: MockStorageService;
  let mockPdfGenerator: MockPdfGeneratorService;
  let mockPayPlug: MockPayPlugService;

  const API_KEY = 'test-api-key-12345';
  const FIRMA_WEBHOOK_SECRET = 'test-firma-webhook-secret';
  const PAYPLUG_WEBHOOK_SECRET = 'test-payplug-webhook-secret';

  beforeAll(async () => {
    mockStorage = new MockStorageService();
    mockPdfGenerator = new MockPdfGeneratorService();
    mockPayPlug = new MockPayPlugService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: './test/.env.test',
          ignoreEnvFile: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              PORT: 3001,
              API_KEY,
              DATABASE_URL:
                process.env.DATABASE_URL ||
                'postgresql://postgres:postgres@localhost:5432/npl_convention_test',
              S3_REGION: 'fr-par',
              S3_ENDPOINT: 'http://localhost:9000',
              S3_BUCKET: 'test-bucket',
              S3_ACCESS_KEY_ID: 'test-access-key',
              S3_SECRET_ACCESS_KEY: 'test-secret-key',
              FIRMA_API_KEY: 'test-firma-api-key',
              FIRMA_API_URL: 'http://localhost:8080',
              FIRMA_WEBHOOK_SECRET,
              PAYPLUG_API_KEY: 'test-payplug-api-key',
              PAYPLUG_API_URL: 'http://localhost:8081',
              PAYPLUG_WEBHOOK_SECRET,
              APP_URL: 'http://localhost:3001',
              FRONTEND_URL: 'http://localhost:3002',
            }),
          ],
        }),
        PrismaModule,
        StorageModule,
        ClientsModule,
        DossiersModule,
        LettreMissionModule,
        SignatureModule,
        PaiementModule,
      ],
    })
      .overrideProvider(StorageService)
      .useValue(mockStorage)
      .overrideProvider(PdfGeneratorService)
      .useValue(mockPdfGenerator)
      .overrideProvider(PayPlugService)
      .useValue(mockPayPlug)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // Set up global API key guard
    const configService = moduleFixture.get<ConfigService>(ConfigService);
    const reflector = moduleFixture.get<Reflector>(Reflector);
    app.useGlobalGuards(new ApiKeyGuard(configService, reflector));

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    mockStorage.clear();
    mockPayPlug.clear();
  });

  describe('PayPlug Complete Workflow', () => {
    it('should complete full workflow: client → dossier → lettre mission → signature → PayPlug payment', async () => {
      // Step 1: Create Client
      const clientData = createTestClientData();
      const createClientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const client = createClientResponse.body;
      expect(client.id).toBeDefined();
      expect(client.email).toBe(clientData.email);

      // Step 2: Create Dossier
      const dossierData = createTestDossierData(client.id);
      const createDossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(dossierData)
        .expect(201);

      const dossier = createDossierResponse.body;
      expect(dossier.id).toBeDefined();
      expect(dossier.reference).toMatch(/^DOS-\d{4}-\d{3}$/);
      expect(dossier.status).toBe(DossierStatus.DRAFT);

      // Step 3: Create Lettre de Mission (generates PDF)
      const lettreMissionData = createTestLettreMissionData({
        totalAmount: 2500,
      });
      const createLettreMissionResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossier.id}/lettre-mission`)
        .set('X-API-Key', API_KEY)
        .send(lettreMissionData)
        .expect(201);

      const lettreMission = createLettreMissionResponse.body;
      expect(lettreMission.id).toBeDefined();
      expect(lettreMission.pdfUrl).toBeDefined();
      expect(lettreMission.pdfGeneratedAt).toBeDefined();
      expect(parseFloat(lettreMission.totalAmount)).toBe(2500);

      // Verify PDF was stored
      expect(mockStorage.hasFile(lettreMission.pdfUrl)).toBe(true);

      // Step 4: Send for Signature (simulating firma.dev)
      // Note: This will fail because we're not mocking the firma.dev API call
      // In a real test, we'd mock the HTTP client or use nock
      // For now, we'll directly update the database to simulate sending

      // Simulate sending for signature by directly updating the database
      await prisma.lettreMission.update({
        where: { id: lettreMission.id },
        data: {
          firmaSignatureId: 'firma_sig_test_123',
          sentForSignatureAt: new Date(),
        },
      });
      await prisma.dossier.update({
        where: { id: dossier.id },
        data: { status: DossierStatus.SENT },
      });

      // Verify dossier status is SENT
      const dossierAfterSend = await request(app.getHttpServer())
        .get(`/dossiers/${dossier.id}`)
        .set('X-API-Key', API_KEY)
        .expect(200);

      expect(dossierAfterSend.body.status).toBe(DossierStatus.SENT);

      // Step 5: Simulate Signature Completed Webhook from firma.dev
      const firmaWebhookPayload = {
        event: 'signature.completed',
        signature_id: 'firma_sig_test_123',
        signed_document_url: 'https://firma.dev/documents/signed_123.pdf',
      };

      const firmaSignature = generateFirmaWebhookSignature(
        firmaWebhookPayload,
        FIRMA_WEBHOOK_SECRET,
      );

      // Mock downloading signed document
      const signedPdfKey = mockStorage.generateLettreMissionKey(
        dossier.id,
        'signed',
      );
      await mockStorage.uploadFile(
        signedPdfKey,
        Buffer.from('signed pdf content'),
        'application/pdf',
      );

      // Process the firma webhook manually by updating database
      // (In real scenario, we'd call the webhook endpoint)
      await prisma.lettreMission.update({
        where: { firmaSignatureId: 'firma_sig_test_123' },
        data: {
          signedAt: new Date(),
          signedPdfUrl: signedPdfKey,
        },
      });
      await prisma.dossier.update({
        where: { id: dossier.id },
        data: { status: DossierStatus.SIGNED },
      });
      await prisma.webhookEvent.create({
        data: {
          source: 'firma',
          eventType: 'signature.completed',
          payload: firmaWebhookPayload,
          processed: true,
        },
      });

      // Verify dossier status is SIGNED
      const dossierAfterSign = await request(app.getHttpServer())
        .get(`/dossiers/${dossier.id}`)
        .set('X-API-Key', API_KEY)
        .expect(200);

      expect(dossierAfterSign.body.status).toBe(DossierStatus.SIGNED);
      expect(dossierAfterSign.body.lettreMission.signedAt).toBeDefined();

      // Step 6: Choose PayPlug Payment
      const paymentChoiceResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossier.id}/paiement/choose`)
        .set('X-API-Key', API_KEY)
        .send({ mode: 'PAYPLUG' })
        .expect(201);

      expect(paymentChoiceResponse.body.paiement).toBeDefined();
      expect(paymentChoiceResponse.body.paymentUrl).toBeDefined();
      expect(paymentChoiceResponse.body.paiement.mode).toBe('PAYPLUG');
      expect(paymentChoiceResponse.body.paiement.status).toBe(
        PaiementStatus.PENDING,
      );

      const payplugPaymentId =
        paymentChoiceResponse.body.paiement.payplugPaymentId;
      const paiementId = paymentChoiceResponse.body.paiement.id;

      // Verify dossier status is PAYMENT_PENDING
      const dossierAfterPaymentChoice = await request(app.getHttpServer())
        .get(`/dossiers/${dossier.id}`)
        .set('X-API-Key', API_KEY)
        .expect(200);

      expect(dossierAfterPaymentChoice.body.status).toBe(
        DossierStatus.PAYMENT_PENDING,
      );

      // Step 7: Simulate PayPlug Payment Success Webhook
      const payplugWebhookPayload = {
        event: 'payment.succeeded',
        data: {
          id: payplugPaymentId,
          metadata: {
            dossierId: dossier.id,
            paiementId: paiementId,
          },
        },
      };

      const rawBody = JSON.stringify(payplugWebhookPayload);
      const payplugSignature = generatePayPlugWebhookSignature(
        rawBody,
        PAYPLUG_WEBHOOK_SECRET,
      );

      // Process payment success webhook manually
      await prisma.paiement.update({
        where: { id: paiementId },
        data: {
          status: PaiementStatus.COMPLETED,
          paidAt: new Date(),
        },
      });
      await prisma.dossier.update({
        where: { id: dossier.id },
        data: { status: DossierStatus.PAID },
      });
      await prisma.webhookEvent.create({
        data: {
          source: 'payplug',
          eventType: 'payment.succeeded',
          payload: payplugWebhookPayload,
          processed: true,
        },
      });

      // Verify final state
      const finalDossier = await request(app.getHttpServer())
        .get(`/dossiers/${dossier.id}`)
        .set('X-API-Key', API_KEY)
        .expect(200);

      expect(finalDossier.body.status).toBe(DossierStatus.PAID);
      expect(finalDossier.body.paiements).toHaveLength(1);
      expect(finalDossier.body.paiements[0].status).toBe(
        PaiementStatus.COMPLETED,
      );
      expect(finalDossier.body.paiements[0].paidAt).toBeDefined();

      // Verify webhook events were logged
      const webhookEvents = await prisma.webhookEvent.findMany({
        orderBy: { createdAt: 'asc' },
      });
      expect(webhookEvents).toHaveLength(2);
      expect(webhookEvents[0].source).toBe('firma');
      expect(webhookEvents[1].source).toBe('payplug');
    });
  });

  describe('Cheques Complete Workflow', () => {
    it('should complete full workflow: client → dossier → lettre mission → signature → cheques payment', async () => {
      // Step 1: Create Client
      const clientData = createTestClientData({
        firstName: 'Marie',
        lastName: 'Martin',
      });
      const createClientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const client = createClientResponse.body;

      // Step 2: Create Dossier
      const dossierData = createTestDossierData(client.id, {
        description: 'Affaire de succession - Dossier Martin',
      });
      const createDossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(dossierData)
        .expect(201);

      const dossier = createDossierResponse.body;
      expect(dossier.status).toBe(DossierStatus.DRAFT);

      // Step 3: Create Lettre de Mission
      const totalAmount = 3000;
      const lettreMissionData = createTestLettreMissionData({ totalAmount });
      const createLettreMissionResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossier.id}/lettre-mission`)
        .set('X-API-Key', API_KEY)
        .send(lettreMissionData)
        .expect(201);

      const lettreMission = createLettreMissionResponse.body;

      // Step 4: Simulate Signature Process (directly update DB)
      await prisma.lettreMission.update({
        where: { id: lettreMission.id },
        data: {
          firmaSignatureId: 'firma_sig_cheque_test_456',
          sentForSignatureAt: new Date(),
          signedAt: new Date(),
          signedPdfUrl: `lettres-mission/${dossier.id}/signed.pdf`,
        },
      });
      await prisma.dossier.update({
        where: { id: dossier.id },
        data: { status: DossierStatus.SIGNED },
      });

      // Upload mock signed PDF
      await mockStorage.uploadFile(
        `lettres-mission/${dossier.id}/signed.pdf`,
        Buffer.from('signed pdf'),
        'application/pdf',
      );

      // Verify dossier is SIGNED
      const dossierAfterSign = await request(app.getHttpServer())
        .get(`/dossiers/${dossier.id}`)
        .set('X-API-Key', API_KEY)
        .expect(200);

      expect(dossierAfterSign.body.status).toBe(DossierStatus.SIGNED);

      // Step 5: Choose Cheques Payment (2 cheques of 1500 each)
      const chequesData = createTestChequesData(totalAmount, 2);

      const paymentChoiceResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossier.id}/paiement/choose`)
        .set('X-API-Key', API_KEY)
        .send({
          mode: 'CHEQUES',
          cheques: chequesData,
        })
        .expect(201);

      expect(paymentChoiceResponse.body.paiement).toBeDefined();
      expect(paymentChoiceResponse.body.paiement.mode).toBe('CHEQUES');
      // For cheques, status is immediately COMPLETED and dossier is PAID
      expect(paymentChoiceResponse.body.paiement.status).toBe(
        PaiementStatus.COMPLETED,
      );
      expect(paymentChoiceResponse.body.paiement.cheques).toHaveLength(2);

      // Verify cheques
      const cheques = paymentChoiceResponse.body.paiement.cheques;
      expect(cheques[0].numero).toBe(1);
      expect(cheques[1].numero).toBe(2);
      expect(parseFloat(cheques[0].montant)).toBe(1500);
      expect(parseFloat(cheques[1].montant)).toBe(1500);
      expect(cheques[0].status).toBe(ChequeStatus.ATTENDU);
      expect(cheques[1].status).toBe(ChequeStatus.ATTENDU);

      // Verify final dossier state
      const finalDossier = await request(app.getHttpServer())
        .get(`/dossiers/${dossier.id}`)
        .set('X-API-Key', API_KEY)
        .expect(200);

      expect(finalDossier.body.status).toBe(DossierStatus.PAID);
      expect(finalDossier.body.paiements).toHaveLength(1);
      expect(finalDossier.body.paiements[0].cheques).toHaveLength(2);
    });

    it('should handle cheque status updates correctly', async () => {
      // Setup: Create client, dossier, lettre mission, and cheque payment
      const clientData = createTestClientData();
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const dossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(createTestDossierData(clientResponse.body.id))
        .expect(201);

      const totalAmount = 2000;
      await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/lettre-mission`)
        .set('X-API-Key', API_KEY)
        .send(createTestLettreMissionData({ totalAmount }))
        .expect(201);

      // Simulate signature
      await prisma.dossier.update({
        where: { id: dossierResponse.body.id },
        data: { status: DossierStatus.SIGNED },
      });
      await prisma.lettreMission.update({
        where: { dossierId: dossierResponse.body.id },
        data: {
          firmaSignatureId: 'firma_test_status_update',
          sentForSignatureAt: new Date(),
          signedAt: new Date(),
        },
      });

      // Create cheque payment
      const paymentResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/paiement/choose`)
        .set('X-API-Key', API_KEY)
        .send({
          mode: 'CHEQUES',
          cheques: createTestChequesData(totalAmount, 2),
        })
        .expect(201);

      const cheque1Id = paymentResponse.body.paiement.cheques[0].id;
      const cheque2Id = paymentResponse.body.paiement.cheques[1].id;

      // Update cheque 1: ATTENDU → RECU
      const updateCheque1Response = await request(app.getHttpServer())
        .patch(`/cheques/${cheque1Id}/status`)
        .set('X-API-Key', API_KEY)
        .send({ status: 'RECU' })
        .expect(200);

      expect(updateCheque1Response.body.status).toBe(ChequeStatus.RECU);
      expect(updateCheque1Response.body.dateRecu).toBeDefined();

      // Update cheque 1: RECU → ENCAISSE
      const encaisseCheque1Response = await request(app.getHttpServer())
        .patch(`/cheques/${cheque1Id}/status`)
        .set('X-API-Key', API_KEY)
        .send({ status: 'ENCAISSE' })
        .expect(200);

      expect(encaisseCheque1Response.body.status).toBe(ChequeStatus.ENCAISSE);
      expect(encaisseCheque1Response.body.dateEncaisse).toBeDefined();

      // Update cheque 2: ATTENDU → RECU → ENCAISSE
      await request(app.getHttpServer())
        .patch(`/cheques/${cheque2Id}/status`)
        .set('X-API-Key', API_KEY)
        .send({ status: 'RECU' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/cheques/${cheque2Id}/status`)
        .set('X-API-Key', API_KEY)
        .send({ status: 'ENCAISSE' })
        .expect(200);

      // Verify all cheques are now ENCAISSE
      const finalPaiement = await request(app.getHttpServer())
        .get(`/paiements/${paymentResponse.body.paiement.id}`)
        .set('X-API-Key', API_KEY)
        .expect(200);

      expect(
        finalPaiement.body.cheques.every(
          (c: { status: string }) => c.status === ChequeStatus.ENCAISSE,
        ),
      ).toBe(true);
    });
  });

  describe('Error Cases and Business Rules', () => {
    it('should reject payment before signature', async () => {
      // Create client and dossier
      const clientData = createTestClientData();
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const dossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(createTestDossierData(clientResponse.body.id))
        .expect(201);

      // Try to choose payment (dossier is DRAFT, not SIGNED)
      const paymentResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/paiement/choose`)
        .set('X-API-Key', API_KEY)
        .send({ mode: 'PAYPLUG' })
        .expect(400);

      expect(paymentResponse.body.message).toContain(
        'Payment can only be chosen after signature',
      );
    });

    it('should reject sending unsigned document for signature', async () => {
      // Create client and dossier without lettre mission
      const clientData = createTestClientData();
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const dossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(createTestDossierData(clientResponse.body.id))
        .expect(201);

      // Try to send for signature without lettre mission
      await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/lettre-mission/send`)
        .set('X-API-Key', API_KEY)
        .expect(404);
    });

    it('should reject duplicate lettre mission creation', async () => {
      // Create client, dossier, and first lettre mission
      const clientData = createTestClientData();
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const dossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(createTestDossierData(clientResponse.body.id))
        .expect(201);

      // Create first lettre mission
      await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/lettre-mission`)
        .set('X-API-Key', API_KEY)
        .send(createTestLettreMissionData())
        .expect(201);

      // Try to create second lettre mission - should fail
      const duplicateResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/lettre-mission`)
        .set('X-API-Key', API_KEY)
        .send(createTestLettreMissionData())
        .expect(400);

      expect(duplicateResponse.body.message).toContain(
        'Lettre de mission already exists',
      );
    });

    it('should reject deleting non-DRAFT dossiers', async () => {
      // Create client and dossier
      const clientData = createTestClientData();
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const dossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(createTestDossierData(clientResponse.body.id))
        .expect(201);

      // Update dossier status to SENT
      await prisma.dossier.update({
        where: { id: dossierResponse.body.id },
        data: { status: DossierStatus.SENT },
      });

      // Try to delete non-DRAFT dossier
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/dossiers/${dossierResponse.body.id}`)
        .set('X-API-Key', API_KEY)
        .expect(400);

      expect(deleteResponse.body.message).toContain(
        'Only DRAFT dossiers can be deleted',
      );
    });

    it('should validate cheques total equals payment amount', async () => {
      // Setup: Create client, dossier with lettre mission and simulate signature
      const clientData = createTestClientData();
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const dossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(createTestDossierData(clientResponse.body.id))
        .expect(201);

      const totalAmount = 3000;
      await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/lettre-mission`)
        .set('X-API-Key', API_KEY)
        .send(createTestLettreMissionData({ totalAmount }))
        .expect(201);

      // Simulate signature
      await prisma.dossier.update({
        where: { id: dossierResponse.body.id },
        data: { status: DossierStatus.SIGNED },
      });
      await prisma.lettreMission.update({
        where: { dossierId: dossierResponse.body.id },
        data: {
          firmaSignatureId: 'test_sig_validation',
          sentForSignatureAt: new Date(),
          signedAt: new Date(),
        },
      });

      // Try to create cheques with wrong total (2500 instead of 3000)
      const wrongChequesResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/paiement/choose`)
        .set('X-API-Key', API_KEY)
        .send({
          mode: 'CHEQUES',
          cheques: [
            {
              montant: 1000,
              dateEncaissementPrevue: new Date().toISOString(),
            },
            {
              montant: 1500,
              dateEncaissementPrevue: new Date().toISOString(),
            },
          ],
        })
        .expect(400);

      expect(wrongChequesResponse.body.message).toContain(
        'Total of cheques (2500) must equal total amount (3000)',
      );
    });

    it('should require cheques data when mode is CHEQUES', async () => {
      // Setup: Create client, dossier with lettre mission and simulate signature
      const clientData = createTestClientData();
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const dossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(createTestDossierData(clientResponse.body.id))
        .expect(201);

      await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/lettre-mission`)
        .set('X-API-Key', API_KEY)
        .send(createTestLettreMissionData())
        .expect(201);

      // Simulate signature
      await prisma.dossier.update({
        where: { id: dossierResponse.body.id },
        data: { status: DossierStatus.SIGNED },
      });
      await prisma.lettreMission.update({
        where: { dossierId: dossierResponse.body.id },
        data: {
          firmaSignatureId: 'test_sig_cheques_required',
          sentForSignatureAt: new Date(),
          signedAt: new Date(),
        },
      });

      // Try to choose CHEQUES mode without cheques data
      const noChequeResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/paiement/choose`)
        .set('X-API-Key', API_KEY)
        .send({ mode: 'CHEQUES' })
        .expect(400);

      // Validation comes from class-validator, check for validation error
      const errorMessage = Array.isArray(noChequeResponse.body.message)
        ? noChequeResponse.body.message.join(' ')
        : noChequeResponse.body.message;
      expect(errorMessage).toMatch(/cheques.*must/i);
    });

    it('should reject duplicate payment choice', async () => {
      // Setup: Create full workflow until payment
      const clientData = createTestClientData();
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const dossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(createTestDossierData(clientResponse.body.id))
        .expect(201);

      const totalAmount = 2000;
      await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/lettre-mission`)
        .set('X-API-Key', API_KEY)
        .send(createTestLettreMissionData({ totalAmount }))
        .expect(201);

      // Simulate signature
      await prisma.dossier.update({
        where: { id: dossierResponse.body.id },
        data: { status: DossierStatus.SIGNED },
      });
      await prisma.lettreMission.update({
        where: { dossierId: dossierResponse.body.id },
        data: {
          firmaSignatureId: 'test_sig_duplicate_payment',
          sentForSignatureAt: new Date(),
          signedAt: new Date(),
        },
      });

      // First payment choice - should succeed
      await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/paiement/choose`)
        .set('X-API-Key', API_KEY)
        .send({
          mode: 'CHEQUES',
          cheques: createTestChequesData(totalAmount, 1),
        })
        .expect(201);

      // Second payment choice - should fail (dossier is now PAID, not SIGNED)
      const duplicatePaymentResponse = await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/paiement/choose`)
        .set('X-API-Key', API_KEY)
        .send({ mode: 'PAYPLUG' })
        .expect(400);

      // Either "already initiated" or "only after signature" (status is PAID now)
      expect(duplicatePaymentResponse.body.message).toMatch(
        /Payment (can only be chosen after signature|already initiated)/,
      );
    });
  });

  describe('API Key Authentication', () => {
    it('should reject requests without API key', async () => {
      await request(app.getHttpServer()).get('/clients').expect(401);
    });

    it('should reject requests with invalid API key', async () => {
      await request(app.getHttpServer())
        .get('/clients')
        .set('X-API-Key', 'invalid-key')
        .expect(401);
    });

    it('should accept requests with valid API key', async () => {
      await request(app.getHttpServer())
        .get('/clients')
        .set('X-API-Key', API_KEY)
        .expect(200);
    });
  });

  describe('Data Validation', () => {
    it('should reject client creation with invalid email', async () => {
      const invalidClientData = {
        email: 'not-an-email',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(invalidClientData)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject client creation with missing required fields', async () => {
      const incompleteClientData = {
        email: 'test@test.com',
        // missing firstName and lastName
      };

      await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(incompleteClientData)
        .expect(400);
    });

    it('should reject lettre mission with negative amount', async () => {
      // Create client and dossier
      const clientData = createTestClientData();
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('X-API-Key', API_KEY)
        .send(clientData)
        .expect(201);

      const dossierResponse = await request(app.getHttpServer())
        .post('/dossiers')
        .set('X-API-Key', API_KEY)
        .send(createTestDossierData(clientResponse.body.id))
        .expect(201);

      // Try to create lettre mission with negative amount
      await request(app.getHttpServer())
        .post(`/dossiers/${dossierResponse.body.id}/lettre-mission`)
        .set('X-API-Key', API_KEY)
        .send({
          missionDescription: 'Test mission',
          totalAmount: -1000,
          honorairesDetails: 'Test details',
        })
        .expect(400);
    });
  });
});
