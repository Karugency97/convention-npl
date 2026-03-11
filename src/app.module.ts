import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { ClientsModule } from './clients/clients.module';
import { DossiersModule } from './dossiers/dossiers.module';
import { StorageModule } from './storage/storage.module';
import { LettreMissionModule } from './lettre-mission/lettre-mission.module';
import { SignatureModule } from './signature/signature.module';
import { PaiementModule } from './paiement/paiement.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      exclude: ['/api/(.*)', '/health', '/auth/(.*)', '/clients/(.*)', '/dossiers/(.*)', '/storage/(.*)', '/webhooks/(.*)', '/paiements/(.*)', '/cheques/(.*)'],
    }),
    PrismaModule,
    AuthModule,
    ClientsModule,
    DossiersModule,
    StorageModule,
    LettreMissionModule,
    SignatureModule,
    PaiementModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
