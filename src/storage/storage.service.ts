import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import * as path from 'path';

type StorageMode = 'local' | 's3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageMode: StorageMode;
  private readonly localStoragePath: string;
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    this.storageMode =
      (this.configService.get<string>('STORAGE_MODE') as StorageMode) || 'local';
    this.localStoragePath =
      this.configService.get<string>('LOCAL_STORAGE_PATH') || './storage';
    this.bucket = this.configService.get<string>('S3_BUCKET') || 'local';

    if (this.storageMode === 's3') {
      this.s3Client = new S3Client({
        region: this.configService.get<string>('S3_REGION'),
        endpoint: this.configService.get<string>('S3_ENDPOINT'),
        credentials: {
          accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID')!,
          secretAccessKey: this.configService.get<string>(
            'S3_SECRET_ACCESS_KEY',
          )!,
        },
        forcePathStyle: true,
      });
      this.logger.log('Storage mode: S3');
    } else {
      this.logger.log(`Storage mode: Local (${this.localStoragePath})`);
    }
  }

  private getLocalFilePath(key: string): string {
    return path.join(this.localStoragePath, key);
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (this.storageMode === 'local') {
      const filePath = this.getLocalFilePath(key);
      await this.ensureDirectoryExists(filePath);
      await fs.writeFile(filePath, buffer);
      this.logger.log(`File uploaded locally: ${filePath}`);
      return key;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client!.send(command);

    this.logger.log(`File uploaded to S3: ${key}`);

    return key;
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    if (this.storageMode === 'local') {
      // For local mode, return a local file path or a placeholder URL
      // In a real scenario, you'd serve this via an endpoint
      const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
      return `${appUrl}/storage/download/${encodeURIComponent(key)}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.s3Client!, command, {
      expiresIn: expiresInSeconds,
    });

    return signedUrl;
  }

  async downloadFile(key: string): Promise<Buffer> {
    if (this.storageMode === 'local') {
      const filePath = this.getLocalFilePath(key);
      return fs.readFile(filePath);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client!.send(command);

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async deleteFile(key: string): Promise<void> {
    if (this.storageMode === 'local') {
      const filePath = this.getLocalFilePath(key);
      try {
        await fs.unlink(filePath);
        this.logger.log(`File deleted locally: ${filePath}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client!.send(command);

    this.logger.log(`File deleted from S3: ${key}`);
  }

  async fileExists(key: string): Promise<boolean> {
    if (this.storageMode === 'local') {
      const filePath = this.getLocalFilePath(key);
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client!.send(command);
      return true;
    } catch {
      return false;
    }
  }

  generateLettreMissionKey(
    dossierId: string,
    type: 'generated' | 'signed',
  ): string {
    return `lettres-mission/${dossierId}/${type}.pdf`;
  }
}
