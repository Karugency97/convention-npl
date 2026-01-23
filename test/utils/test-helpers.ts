import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * Clean up database tables in the correct order (respecting foreign keys)
 * Uses try-catch to handle cases where tables may not exist yet
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  try {
    // Delete in correct order to respect foreign key constraints
    await prisma.webhookEvent.deleteMany();
    await prisma.cheque.deleteMany();
    await prisma.paiement.deleteMany();
    await prisma.lettreMission.deleteMany();
    await prisma.dossier.deleteMany();
    await prisma.client.deleteMany();
  } catch (error) {
    // If tables don't exist, migrations haven't been run
    // This is expected in some environments
    const message =
      error instanceof Error ? error.message : 'Unknown database error';
    if (message.includes('does not exist')) {
      console.warn(
        'Warning: Some tables do not exist. Run prisma migrate first.',
      );
    } else {
      throw error;
    }
  }
}

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
}

/**
 * Generate a firma.dev webhook signature for testing
 */
export function generateFirmaWebhookSignature(
  payload: object,
  secret: string,
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Generate a PayPlug webhook signature for testing
 */
export function generatePayPlugWebhookSignature(
  rawBody: string,
  secret: string,
): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Helper to create a complete test client
 */
export interface TestClientData {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
}

export function createTestClientData(
  overrides: Partial<TestClientData> = {},
): TestClientData {
  return {
    email: generateTestEmail(),
    firstName: 'Jean',
    lastName: 'Dupont',
    phone: '+33 6 12 34 56 78',
    address: '10 rue de la Paix, 75002 Paris',
    ...overrides,
  };
}

/**
 * Helper to create test dossier data
 */
export interface TestDossierData {
  clientId: string;
  description: string;
}

export function createTestDossierData(
  clientId: string,
  overrides: Partial<TestDossierData> = {},
): TestDossierData {
  return {
    clientId,
    description: 'Litige commercial - Affaire XYZ',
    ...overrides,
  };
}

/**
 * Helper to create test lettre mission data
 */
export interface TestLettreMissionData {
  missionDescription: string;
  totalAmount: number;
  honorairesDetails: string;
}

export function createTestLettreMissionData(
  overrides: Partial<TestLettreMissionData> = {},
): TestLettreMissionData {
  return {
    missionDescription:
      'Représentation du client dans le cadre du litige commercial XYZ',
    totalAmount: 3000,
    honorairesDetails:
      'Honoraires forfaitaires pour la mission de conseil et représentation',
    ...overrides,
  };
}

/**
 * Helper to create test cheque data
 */
export interface TestChequeData {
  montant: number;
  dateEncaissementPrevue: string;
}

export function createTestChequesData(
  totalAmount: number,
  numberOfCheques: number = 2,
): TestChequeData[] {
  const amountPerCheque = totalAmount / numberOfCheques;
  const cheques: TestChequeData[] = [];

  for (let i = 0; i < numberOfCheques; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() + i + 1);

    cheques.push({
      montant: amountPerCheque,
      dateEncaissementPrevue: date.toISOString(),
    });
  }

  return cheques;
}

/**
 * Wait helper for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get application base URL for tests
 */
export function getBaseUrl(app: INestApplication): string {
  const httpServer = app.getHttpServer();
  const address = httpServer.address();
  if (typeof address === 'string') {
    return address;
  }
  return `http://localhost:${address?.port || 3000}`;
}
