import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  @Get('download/*path')
  async downloadFile(
    @Param('path') pathSegments: string[],
    @Res() res: Response,
  ): Promise<void> {
    const key = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
    try {
      const buffer = await this.storageService.downloadFile(key);

      // Determine content type based on extension
      const contentType = key.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${key.split('/').pop()}"`,
      );
      res.send(buffer);
    } catch (error) {
      this.logger.error(`Failed to download file: ${key}`, error);
      throw new NotFoundException('File not found');
    }
  }
}
