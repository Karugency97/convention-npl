import { Module } from '@nestjs/common';
import { LettreMissionController } from './lettre-mission.controller';
import { LettreMissionService } from './lettre-mission.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [StorageModule, PrismaModule],
  controllers: [LettreMissionController],
  providers: [LettreMissionService, PdfGeneratorService],
  exports: [LettreMissionService],
})
export class LettreMissionModule {}
