import { Controller, Post, Get, Param } from '@nestjs/common';
import { SignatureService } from './signature.service';

@Controller()
export class SignatureController {
  constructor(private readonly signatureService: SignatureService) {}

  @Post('dossiers/:dossierId/lettre-mission/send')
  sendForSignature(@Param('dossierId') dossierId: string) {
    return this.signatureService.sendForSignature(dossierId);
  }

  @Get('dossiers/:dossierId/signature-status')
  getSignatureStatus(@Param('dossierId') dossierId: string) {
    return this.signatureService.getSignatureStatus(dossierId);
  }
}
