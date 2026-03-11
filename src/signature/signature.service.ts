import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DossierStatus } from '@prisma/client';
import * as crypto from 'crypto';

interface FirmaCreateSignatureResponse {
  id: string;
  status: string;
  document_url?: string;
}

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);
  private readonly firmaApiKey: string;
  private readonly firmaApiUrl: string;
  private readonly firmaWebhookSecret: string;
  private readonly appUrl: string;

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private configService: ConfigService,
  ) {
    this.firmaApiKey = this.configService.get<string>('FIRMA_API_KEY')!;
    this.firmaApiUrl = this.configService.get<string>('FIRMA_API_URL')!;
    this.firmaWebhookSecret = this.configService.get<string>(
      'FIRMA_WEBHOOK_SECRET',
    )!;
    this.appUrl = this.configService.get<string>('APP_URL')!;
  }

  async sendForSignature(dossierId: string) {
    const lettreMission = await this.prisma.lettreMission.findUnique({
      where: { dossierId },
      include: {
        dossier: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!lettreMission) {
      throw new NotFoundException('Lettre de mission not found');
    }

    if (!lettreMission.pdfUrl) {
      throw new BadRequestException('PDF not generated');
    }

    if (lettreMission.sentForSignatureAt) {
      throw new BadRequestException('Already sent for signature');
    }

    if (lettreMission.dossier.status !== DossierStatus.DRAFT) {
      throw new BadRequestException(
        'Dossier must be in DRAFT status to send for signature',
      );
    }

    const pdfBuffer = await this.storageService.downloadFile(
      lettreMission.pdfUrl,
    );

    const firmaResponse = await this.createSignatureRequest(
      pdfBuffer,
      lettreMission.dossier.client.email,
      `${lettreMission.dossier.client.firstName} ${lettreMission.dossier.client.lastName}`,
      {
        dossierId,
        reference: lettreMission.dossier.reference,
      },
    );

    // Send the signing request to trigger email delivery
    await this.sendSignatureRequest(firmaResponse.id);

    await this.prisma.$transaction([
      this.prisma.lettreMission.update({
        where: { dossierId },
        data: {
          firmaSignatureId: firmaResponse.id,
          sentForSignatureAt: new Date(),
        },
      }),
      this.prisma.dossier.update({
        where: { id: dossierId },
        data: {
          status: DossierStatus.SENT,
        },
      }),
    ]);

    this.logger.log(`Signature request sent for dossier: ${dossierId}`);

    return {
      signatureId: firmaResponse.id,
      status: 'sent',
      message: 'Le client recevra un email avec le lien de signature',
    };
  }

  private async createSignatureRequest(
    pdfBuffer: Buffer,
    signerEmail: string,
    signerName: string,
    metadata: Record<string, string>,
  ): Promise<FirmaCreateSignatureResponse> {
    // Convert PDF to base64
    const documentBase64 = pdfBuffer.toString('base64');

    // Parse signer name into first/last name
    const nameParts = signerName.trim().split(' ');
    const firstName = nameParts[0] || 'Client';
    const lastName = nameParts.slice(1).join(' ') || '';

    const requestBody = {
      document: documentBase64,
      name: `Convention - ${metadata.reference}`,
      recipients: [
        {
          id: 'temp_1',
          first_name: firstName,
          last_name: lastName,
          email: signerEmail,
          designation: 'Signer',
          order: 1,
        },
      ],
      fields: [
        {
          type: 'signature',
          position: {
            x: 10,
            y: 85,
            width: 30,
            height: 5,
          },
          page_number: 1,
          required: true,
          recipient_id: 'temp_1',
        },
        {
          type: 'date',
          position: {
            x: 10,
            y: 80,
            width: 20,
            height: 3,
          },
          page_number: 1,
          required: true,
          recipient_id: 'temp_1',
          date_signing_default: true,
        },
      ],
      expiration_hours: 168,
    };

    const response = await fetch(
      `${this.firmaApiUrl}/functions/v1/signing-request-api/signing-requests`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.firmaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Firma API error: ${error}`);
      throw new BadRequestException('Failed to create signature request');
    }

    return response.json() as Promise<FirmaCreateSignatureResponse>;
  }

  private async sendSignatureRequest(signingRequestId: string): Promise<void> {
    const response = await fetch(
      `${this.firmaApiUrl}/functions/v1/signing-request-api/signing-requests/${signingRequestId}/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.firmaApiKey}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Firma API send error: ${error}`);
      throw new BadRequestException('Failed to send signature request');
    }

    this.logger.log(`Signing request sent: ${signingRequestId}`);
  }

  async handleWebhook(
    payload: {
      event_id: string;
      event_type: string;
      timestamp: string;
      data: {
        signing_request_id: string;
        status?: string;
        final_document_download_url?: string;
        recipient?: Record<string, unknown>;
      };
    },
    signature: string,
  ) {
    if (!this.verifyWebhookSignature(payload, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const existingEvent = await this.prisma.webhookEvent.findFirst({
      where: {
        source: 'firma',
        eventType: payload.event_type,
        payload: {
          path: ['event_id'],
          equals: payload.event_id,
        },
        processed: true,
      },
    });

    if (existingEvent) {
      this.logger.log(
        `Duplicate webhook ignored: ${payload.event_type} for ${payload.data.signing_request_id}`,
      );
      return { status: 'already_processed' };
    }

    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        source: 'firma',
        eventType: payload.event_type,
        payload: payload as object,
      },
    });

    try {
      switch (payload.event_type) {
        case 'signing_request.completed':
          await this.handleSignatureCompleted({
            signing_request_id: payload.data.signing_request_id,
            final_document_download_url: payload.data.final_document_download_url,
          });
          break;
        case 'signing_request.cancelled':
          await this.handleSignatureRejected({
            signing_request_id: payload.data.signing_request_id,
          });
          break;
        case 'signing_request.expired':
          await this.handleSignatureExpired({
            signing_request_id: payload.data.signing_request_id,
          });
          break;
        default:
          this.logger.log(`Firma event received: ${payload.event_type}`);
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true },
      });

      return { status: 'processed' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { error: errorMessage },
      });
      throw error;
    }
  }

  private async handleSignatureCompleted(payload: {
    signing_request_id: string;
    final_document_download_url?: string;
  }) {
    const lettreMission = await this.prisma.lettreMission.findUnique({
      where: { firmaSignatureId: payload.signing_request_id },
      include: { dossier: true },
    });

    if (!lettreMission) {
      throw new NotFoundException(
        `Lettre mission not found for signature: ${payload.signing_request_id}`,
      );
    }

    let signedPdfKey: string | null = null;

    if (payload.final_document_download_url) {
      const signedPdfBuffer = await this.downloadSignedDocument(
        payload.final_document_download_url,
      );
      signedPdfKey = this.storageService.generateLettreMissionKey(
        lettreMission.dossierId,
        'signed',
      );
      await this.storageService.uploadFile(
        signedPdfKey,
        signedPdfBuffer,
        'application/pdf',
      );
    }

    await this.prisma.$transaction([
      this.prisma.lettreMission.update({
        where: { id: lettreMission.id },
        data: {
          signedAt: new Date(),
          signedPdfUrl: signedPdfKey,
        },
      }),
      this.prisma.dossier.update({
        where: { id: lettreMission.dossierId },
        data: {
          status: DossierStatus.SIGNED,
        },
      }),
    ]);

    this.logger.log(
      `Signature completed for dossier: ${lettreMission.dossierId}`,
    );
  }

  private async handleSignatureRejected(payload: { signing_request_id: string }) {
    const lettreMission = await this.prisma.lettreMission.findUnique({
      where: { firmaSignatureId: payload.signing_request_id },
    });

    if (!lettreMission) {
      throw new NotFoundException(
        `Lettre mission not found for signature: ${payload.signing_request_id}`,
      );
    }

    await this.prisma.dossier.update({
      where: { id: lettreMission.dossierId },
      data: {
        status: DossierStatus.CANCELLED,
      },
    });

    this.logger.log(
      `Signature rejected for dossier: ${lettreMission.dossierId}`,
    );
  }

  private async handleSignatureExpired(payload: { signing_request_id: string }) {
    const lettreMission = await this.prisma.lettreMission.findUnique({
      where: { firmaSignatureId: payload.signing_request_id },
    });

    if (!lettreMission) {
      throw new NotFoundException(
        `Lettre mission not found for signature: ${payload.signing_request_id}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.lettreMission.update({
        where: { id: lettreMission.id },
        data: {
          firmaSignatureId: null,
          sentForSignatureAt: null,
        },
      }),
      this.prisma.dossier.update({
        where: { id: lettreMission.dossierId },
        data: {
          status: DossierStatus.DRAFT,
        },
      }),
    ]);

    this.logger.log(
      `Signature expired for dossier: ${lettreMission.dossierId}`,
    );
  }

  private async downloadSignedDocument(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.firmaApiKey}`,
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to download signed document');
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private verifyWebhookSignature(payload: object, signature: string): boolean {
    const computedSignature = crypto
      .createHmac('sha256', this.firmaWebhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const sigBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);

    if (sigBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, computedBuffer);
  }

  async getSignatureStatus(dossierId: string) {
    const lettreMission = await this.prisma.lettreMission.findUnique({
      where: { dossierId },
      include: {
        dossier: true,
      },
    });

    if (!lettreMission) {
      throw new NotFoundException('Lettre de mission not found');
    }

    return {
      dossierId,
      status: lettreMission.dossier.status,
      firmaSignatureId: lettreMission.firmaSignatureId,
      sentForSignatureAt: lettreMission.sentForSignatureAt,
      signedAt: lettreMission.signedAt,
      hasSignedPdf: !!lettreMission.signedPdfUrl,
    };
  }
}
