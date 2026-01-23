import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { LettreMissionService } from './lettre-mission.service';
import { CreateLettreMissionDto } from './dto/create-lettre-mission.dto';

@Controller('dossiers/:dossierId/lettre-mission')
export class LettreMissionController {
  constructor(private readonly lettreMissionService: LettreMissionService) {}

  @Post()
  create(
    @Param('dossierId') dossierId: string,
    @Body() createLettreMissionDto: CreateLettreMissionDto,
  ) {
    return this.lettreMissionService.create(dossierId, createLettreMissionDto);
  }

  @Get()
  findOne(@Param('dossierId') dossierId: string) {
    return this.lettreMissionService.findByDossierId(dossierId);
  }

  @Get('pdf')
  getPdfUrl(
    @Param('dossierId') dossierId: string,
    @Query('signed') signed?: string,
  ) {
    return this.lettreMissionService.getPdfDownloadUrl(
      dossierId,
      signed === 'true',
    );
  }

  @Post('regenerate')
  regeneratePdf(@Param('dossierId') dossierId: string) {
    return this.lettreMissionService.regeneratePdf(dossierId);
  }
}
