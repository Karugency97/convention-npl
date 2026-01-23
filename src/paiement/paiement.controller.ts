import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { PaiementService } from './paiement.service';
import { ChequesService } from './cheques.service';
import { ChoosePaiementDto } from './dto/create-paiement.dto';
import { UpdateChequeStatusDto } from './dto/update-cheque.dto';
import { ChequeStatus } from '@prisma/client';

@Controller()
export class PaiementController {
  constructor(
    private readonly paiementService: PaiementService,
    private readonly chequesService: ChequesService,
  ) {}

  @Post('dossiers/:dossierId/paiement/choose')
  choosePaiement(
    @Param('dossierId') dossierId: string,
    @Body() dto: ChoosePaiementDto,
  ) {
    return this.paiementService.choosePaiement(dossierId, dto);
  }

  @Get('paiements/:id')
  findOne(@Param('id') id: string) {
    return this.paiementService.findOne(id);
  }

  @Get('dossiers/:dossierId/paiements')
  findByDossier(@Param('dossierId') dossierId: string) {
    return this.paiementService.findByDossier(dossierId);
  }

  @Get('cheques')
  findAllCheques(
    @Query('paiementId') paiementId?: string,
    @Query('status') status?: ChequeStatus,
    @Query('dossierId') dossierId?: string,
  ) {
    return this.chequesService.findAll({ paiementId, status, dossierId });
  }

  @Get('cheques/:id')
  findOneCheque(@Param('id') id: string) {
    return this.chequesService.findOne(id);
  }

  @Patch('cheques/:id/status')
  updateChequeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateChequeStatusDto,
  ) {
    return this.chequesService.updateStatus(id, dto.status);
  }

  @Get('dossiers/:dossierId/cheques')
  getChequesByDossier(@Param('dossierId') dossierId: string) {
    return this.chequesService.getChequesByDossier(dossierId);
  }
}
