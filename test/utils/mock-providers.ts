import { Provider } from '@nestjs/common';
import { StorageService } from '../../src/storage/storage.service';
import { SignatureService } from '../../src/signature/signature.service';
import { PayPlugService } from '../../src/paiement/payplug.service';
import { PdfGeneratorService } from '../../src/lettre-mission/pdf-generator.service';

/**
 * Mock Storage Service - stores files in memory instead of S3
 */
export class MockStorageService {
  private files: Map<string, Buffer> = new Map();

  async uploadFile(
    key: string,
    buffer: Buffer,
    _contentType: string,
  ): Promise<string> {
    this.files.set(key, buffer);
    return key;
  }

  async getSignedDownloadUrl(
    key: string,
    _expiresInSeconds: number = 3600,
  ): Promise<string> {
    if (!this.files.has(key)) {
      throw new Error(`File not found: ${key}`);
    }
    return `https://mock-storage.test/${key}?signed=true`;
  }

  async downloadFile(key: string): Promise<Buffer> {
    const file = this.files.get(key);
    if (!file) {
      throw new Error(`File not found: ${key}`);
    }
    return file;
  }

  async deleteFile(key: string): Promise<void> {
    this.files.delete(key);
  }

  generateLettreMissionKey(
    dossierId: string,
    type: 'generated' | 'signed',
  ): string {
    return `lettres-mission/${dossierId}/${type}.pdf`;
  }

  // Helper for tests
  clear(): void {
    this.files.clear();
  }

  hasFile(key: string): boolean {
    return this.files.has(key);
  }
}

/**
 * Mock PDF Generator Service - returns a simple PDF buffer
 */
export class MockPdfGeneratorService {
  async generateLettreMissionPdf(_templateData: unknown): Promise<Buffer> {
    // Return a minimal valid PDF
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
196
%%EOF`;
    return Buffer.from(pdfContent);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }
}

/**
 * Mock PayPlug Service - simulates PayPlug API
 */
export class MockPayPlugService {
  private payments: Map<
    string,
    { isPaid: boolean; isFailed: boolean; metadata: Record<string, string> }
  > = new Map();
  private paymentCounter = 0;

  async createPayment(
    amountCents: number,
    metadata: Record<string, string>,
    _customer?: {
      email?: string;
      firstName?: string;
      lastName?: string;
    },
  ): Promise<{ paymentId: string; paymentUrl: string }> {
    const paymentId = `pay_test_${++this.paymentCounter}_${Date.now()}`;
    this.payments.set(paymentId, { isPaid: false, isFailed: false, metadata });

    return {
      paymentId,
      paymentUrl: `https://mock-payplug.test/pay/${paymentId}?amount=${amountCents}`,
    };
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    // Always return true for testing (actual signature verified in test)
    return true;
  }

  async getPaymentStatus(paymentId: string): Promise<{
    id: string;
    is_paid: boolean;
    is_refunded: boolean;
    failure?: { code: string; message: string };
  }> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    return {
      id: paymentId,
      is_paid: payment.isPaid,
      is_refunded: false,
      ...(payment.isFailed && {
        failure: { code: 'TEST_FAILURE', message: 'Test failure' },
      }),
    };
  }

  // Helper methods for tests
  simulatePaymentSuccess(paymentId: string): void {
    const payment = this.payments.get(paymentId);
    if (payment) {
      payment.isPaid = true;
    }
  }

  simulatePaymentFailure(paymentId: string): void {
    const payment = this.payments.get(paymentId);
    if (payment) {
      payment.isFailed = true;
    }
  }

  clear(): void {
    this.payments.clear();
    this.paymentCounter = 0;
  }

  getPaymentMetadata(paymentId: string): Record<string, string> | undefined {
    return this.payments.get(paymentId)?.metadata;
  }
}

/**
 * Create all mock providers for E2E testing
 */
export function createMockProviders(): {
  providers: Provider[];
  mockStorage: MockStorageService;
  mockPdfGenerator: MockPdfGeneratorService;
  mockPayPlug: MockPayPlugService;
} {
  const mockStorage = new MockStorageService();
  const mockPdfGenerator = new MockPdfGeneratorService();
  const mockPayPlug = new MockPayPlugService();

  const providers: Provider[] = [
    {
      provide: StorageService,
      useValue: mockStorage,
    },
    {
      provide: PdfGeneratorService,
      useValue: mockPdfGenerator,
    },
    {
      provide: PayPlugService,
      useValue: mockPayPlug,
    },
  ];

  return {
    providers,
    mockStorage,
    mockPdfGenerator,
    mockPayPlug,
  };
}

/**
 * Override specific providers in a test module
 */
export function getOverrideProviders(mocks: {
  mockStorage: MockStorageService;
  mockPdfGenerator: MockPdfGeneratorService;
  mockPayPlug: MockPayPlugService;
}): Array<{ provide: unknown; useValue: unknown }> {
  return [
    { provide: StorageService, useValue: mocks.mockStorage },
    { provide: PdfGeneratorService, useValue: mocks.mockPdfGenerator },
    { provide: PayPlugService, useValue: mocks.mockPayPlug },
  ];
}
