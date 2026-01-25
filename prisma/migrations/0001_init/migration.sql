-- CreateEnum
CREATE TYPE "DossierStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'PAYMENT_PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaiementMode" AS ENUM ('PAYPLUG', 'CHEQUES');

-- CreateEnum
CREATE TYPE "PaiementStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChequeStatus" AS ENUM ('ATTENDU', 'RECU', 'ENCAISSE');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DossierStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LettreMission" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "templateData" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "firmaSignatureId" TEXT,
    "sentForSignatureAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedPdfUrl" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LettreMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "mode" "PaiementMode" NOT NULL,
    "status" "PaiementStatus" NOT NULL DEFAULT 'PENDING',
    "payplugPaymentId" TEXT,
    "payplugUrl" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheque" (
    "id" TEXT NOT NULL,
    "paiementId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "dateEncaissementPrevue" TIMESTAMP(3) NOT NULL,
    "status" "ChequeStatus" NOT NULL DEFAULT 'ATTENDU',
    "dateRecu" TIMESTAMP(3),
    "dateEncaisse" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Dossier_reference_key" ON "Dossier"("reference");

-- CreateIndex
CREATE INDEX "Dossier_clientId_idx" ON "Dossier"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "LettreMission_dossierId_key" ON "LettreMission"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "LettreMission_firmaSignatureId_key" ON "LettreMission"("firmaSignatureId");

-- CreateIndex
CREATE INDEX "LettreMission_dossierId_idx" ON "LettreMission"("dossierId");

-- CreateIndex
CREATE INDEX "LettreMission_firmaSignatureId_idx" ON "LettreMission"("firmaSignatureId");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_payplugPaymentId_key" ON "Paiement"("payplugPaymentId");

-- CreateIndex
CREATE INDEX "Paiement_dossierId_idx" ON "Paiement"("dossierId");

-- CreateIndex
CREATE INDEX "Paiement_payplugPaymentId_idx" ON "Paiement"("payplugPaymentId");

-- CreateIndex
CREATE INDEX "Cheque_paiementId_idx" ON "Cheque"("paiementId");

-- CreateIndex
CREATE INDEX "WebhookEvent_source_eventType_idx" ON "WebhookEvent"("source", "eventType");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LettreMission" ADD CONSTRAINT "LettreMission_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "Paiement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
