import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DossiersService } from './dossiers.service';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { DossierStatus } from '@prisma/client';

@Controller('dossiers')
export class DossiersController {
  constructor(private readonly dossiersService: DossiersService) {}

  @Post()
  create(@Body() createDossierDto: CreateDossierDto) {
    return this.dossiersService.create(createDossierDto);
  }

  @Get()
  findAll(
    @Query('status') status?: DossierStatus,
    @Query('clientId') clientId?: string,
  ) {
    return this.dossiersService.findAll({ status, clientId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dossiersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDossierDto: UpdateDossierDto) {
    return this.dossiersService.update(id, updateDossierDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dossiersService.remove(id);
  }
}
