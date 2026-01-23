# Technical Specification: NPL Convention Management System

## Complexity Assessment

**Difficulty: HARD**

Rationale:
- Multiple external integrations (firma.dev, PayPlug) with webhook management
- Complex business workflow with state management (draft → sent → signed → paid)
- Legal compliance requirements (RGPD, professional secrecy)
- Document generation and versioning
- Payment orchestration with multiple modes
- Full greenfield NestJS application
- High stakes (legal/financial documents)

---

## Technical Context

### Stack
- **Runtime**: Node.js ≥ 20
- **Framework**: NestJS (latest stable)
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **PDF Generation**: Puppeteer (headless Chrome)
- **Object Storage**: Scaleway Object Storage (S3-compatible, EU-hosted)
- **Integrations**:
  - firma.dev (e-signature)
  - PayPlug (payment processing)

### Hosting Constraints
- EU-only hosting (RGPD compliance)
- Recommended: Scaleway, OVH, or similar EU provider
- Secret professional avocat compliance

---

## Data Model

### Prisma Schema

```prisma
// Client entity
model Client {
  id        String   @id @default(cuid())
  email     String   @unique
  firstName String
  lastName  String
  phone     String?
  address   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  dossiers  Dossier[]
}

// Case/Dossier
model Dossier {
  id          String        @id @default(cuid())
  reference   String        @unique // e.g., "DOS-2026-001"
  clientId    String
  client      Client        @relation(fields: [clientId], references: [id])
  description String
  status      DossierStatus @default(DRAFT)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  
  lettreMission LettreMission?
  paiements     Paiement[]
  
  @@index([clientId])
}

enum DossierStatus {
  DRAFT          // Initial state
  SENT           // Sent for signature
  SIGNED         // Signed, awaiting payment choice
  PAYMENT_PENDING // Payment choice made, awaiting confirmation
  PAID           // Fully paid
  CANCELLED      // Cancelled
}

// Mission letter (convention d'honoraires)
model LettreMission {
  id                String              @id @default(cuid())
  dossierId         String              @unique
  dossier           Dossier             @relation(fields: [dossierId], references: [id])
  
  // Template data (JSON stored)
  templateData      Json
  
  // Generated PDF
  pdfUrl            String?             // Storage URL
  pdfGeneratedAt    DateTime?
  
  // Signature tracking
  firmaSignatureId  String?             @unique
  sentForSignatureAt DateTime?
  signedAt          DateTime?
  signedPdfUrl      String?             // Signed PDF from firma.dev
  
  // Amounts
  totalAmount       Decimal             @db.Decimal(10, 2)
  
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  @@index([dossierId])
  @@index([firmaSignatureId])
}

// Payment entity
model Paiement {
  id              String         @id @default(cuid())
  dossierId       String
  dossier         Dossier        @relation(fields: [dossierId], references: [id])
  
  mode            PaiementMode
  status          PaiementStatus @default(PENDING)
  
  // PayPlug specific
  payplugPaymentId String?       @unique
  payplugUrl       String?       // Redirect URL for client
  
  amount          Decimal        @db.Decimal(10, 2)
  
  paidAt          DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  cheques         Cheque[]
  
  @@index([dossierId])
  @@index([payplugPaymentId])
}

enum PaiementMode {
  PAYPLUG   // Online payment (instant or installments)
  CHEQUES   // Check payment (one or more)
}

enum PaiementStatus {
  PENDING    // Awaiting payment/checks
  COMPLETED  // PayPlug confirmed OR all checks registered
  FAILED     // PayPlug failed
  CANCELLED  // Cancelled
}

// Check tracking
model Cheque {
  id          String        @id @default(cuid())
  paiementId  String
  paiement    Paiement      @relation(fields: [paiementId], references: [id])
  
  numero      Int           // Check number in sequence (1, 2, 3...)
  montant     Decimal       @db.Decimal(10, 2)
  dateEncaissementPrevue DateTime // Expected deposit date
  
  status      ChequeStatus  @default(ATTENDU)
  dateRecu    DateTime?     // Date received
  dateEncaisse DateTime?    // Date deposited
  
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  
  @@index([paiementId])
}

enum ChequeStatus {
  ATTENDU    // Awaiting receipt
  RECU       // Received
  ENCAISSE   // Deposited
}

// Webhook event log (audit trail)
model WebhookEvent {
  id         String   @id @default(cuid())
  source     String   // 'firma' or 'payplug'
  eventType  String   // Event type from webhook
  payload    Json     // Full webhook payload
  processed  Boolean  @default(false)
  error      String?  // Error if processing failed
  createdAt  DateTime @default(now())
  
  @@index([source, eventType])
  @@index([createdAt])
}
```

---

## Architecture Overview

### Module Structure

```
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── config.module.ts
│   ├── configuration.ts              # Environment config
│   └── validation.schema.ts          # Env validation
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── clients/
│   ├── clients.module.ts
│   ├── clients.controller.ts
│   ├── clients.service.ts
│   └── dto/
│       ├── create-client.dto.ts
│       └── update-client.dto.ts
├── dossiers/
│   ├── dossiers.module.ts
│   ├── dossiers.controller.ts
│   ├── dossiers.service.ts
│   └── dto/
│       ├── create-dossier.dto.ts
│       └── update-dossier.dto.ts
├── lettre-mission/
│   ├── lettre-mission.module.ts
│   ├── lettre-mission.controller.ts
│   ├── lettre-mission.service.ts
│   ├── pdf-generator.service.ts      # Puppeteer PDF generation
│   ├── templates/
│   │   └── convention.html           # HTML template
│   └── dto/
│       └── create-lettre-mission.dto.ts
├── signature/
│   ├── signature.module.ts
│   ├── signature.service.ts          # firma.dev integration
│   ├── signature-webhook.controller.ts
│   └── dto/
│       └── firma-webhook.dto.ts
├── paiement/
│   ├── paiement.module.ts
│   ├── paiement.controller.ts
│   ├── paiement.service.ts
│   ├── payplug.service.ts            # PayPlug integration
│   ├── cheques.service.ts            # Check management
│   ├── paiement-webhook.controller.ts
│   └── dto/
│       ├── create-paiement.dto.ts
│       ├── create-cheque.dto.ts
│       └── payplug-webhook.dto.ts
├── storage/
│   ├── storage.module.ts
│   └── storage.service.ts            # S3-compatible storage
└── common/
    ├── guards/
    │   └── api-key.guard.ts          # Simple API key auth
    ├── interceptors/
    │   └── logging.interceptor.ts
    └── filters/
        └── http-exception.filter.ts
```

---

## API Endpoints

### Clients

- `POST /clients` - Create a client
- `GET /clients` - List all clients
- `GET /clients/:id` - Get client details
- `PATCH /clients/:id` - Update client
- `DELETE /clients/:id` - Delete client (soft delete if has dossiers)

### Dossiers

- `POST /dossiers` - Create a dossier
- `GET /dossiers` - List all dossiers (with filters)
- `GET /dossiers/:id` - Get dossier details (includes lettre, paiements)
- `PATCH /dossiers/:id` - Update dossier
- `DELETE /dossiers/:id` - Delete dossier (only if DRAFT)

### Lettre Mission

- `POST /dossiers/:dossierId/lettre-mission` - Create and generate PDF
- `GET /dossiers/:dossierId/lettre-mission` - Get lettre mission details
- `POST /dossiers/:dossierId/lettre-mission/send` - Send for signature via firma.dev
- `GET /dossiers/:dossierId/lettre-mission/pdf` - Download PDF (pre-signature)
- `GET /dossiers/:dossierId/lettre-mission/signed-pdf` - Download signed PDF

### Signature (Webhooks)

- `POST /webhooks/firma` - Receive firma.dev webhooks

### Paiement

- `POST /dossiers/:dossierId/paiement/choose` - Choose payment method (after signature)
- `GET /paiements/:id` - Get payment details
- `GET /dossiers/:dossierId/paiements` - List all payments for a dossier

### Paiement - PayPlug

- `POST /webhooks/payplug` - Receive PayPlug webhooks

### Paiement - Cheques

- `POST /paiements/:paiementId/cheques` - Add checks for a payment
- `PATCH /cheques/:id/status` - Update check status (ATTENDU → RECU → ENCAISSE)
- `GET /cheques` - List all checks (with filters)

---

## Business Workflow

### 1. Dossier Creation
```
Client creates → Dossier (DRAFT)
```

### 2. Lettre Mission Generation
```
POST /dossiers/:id/lettre-mission
→ Generate PDF with Puppeteer
→ Store in S3
→ Dossier remains DRAFT
```

### 3. Signature Process
```
POST /dossiers/:id/lettre-mission/send
→ Upload PDF to firma.dev
→ Send signature request to client
→ Store firmaSignatureId
→ Dossier status → SENT

[Client signs on firma.dev]

firma.dev webhook → POST /webhooks/firma
→ Download signed PDF
→ Store signed PDF in S3
→ Update LettreMission (signedAt, signedPdfUrl)
→ Dossier status → SIGNED
→ Trigger payment choice flow
```

### 4. Payment Choice (MANDATORY after signature)
```
POST /dossiers/:id/paiement/choose
Body: {
  mode: 'PAYPLUG' | 'CHEQUES',
  ... mode-specific data
}

If PAYPLUG:
  → Create PayPlug payment
  → Return paymentUrl for client redirect
  → Dossier status → PAYMENT_PENDING
  
If CHEQUES:
  → Create Paiement record
  → Create Cheque records (with amounts, dates)
  → Dossier status → PAID (checks are pre-validated)
  → All cheques start as ATTENDU
```

### 5. Payment Confirmation

**PayPlug:**
```
PayPlug webhook → POST /webhooks/payplug
→ Update Paiement status → COMPLETED
→ Dossier status → PAID
```

**Cheques:**
```
Manual updates:
PATCH /cheques/:id/status
→ ATTENDU → RECU (mark date)
→ RECU → ENCAISSE (mark date)
```

---

## Integration Details

### firma.dev API

**Documentation**: https://docs.firma.dev

**Key Operations:**
1. Create signature request
   - Upload PDF
   - Specify signer email
   - Set webhook URL
   - Get signature ID

2. Webhooks:
   - `signature.completed` - Document signed
   - `signature.rejected` - Signature refused
   - `signature.expired` - Signature expired

**Security:**
- Webhook signature verification (HMAC)
- Store firma API key in environment

### PayPlug API

**Documentation**: https://docs.payplug.com

**Key Operations:**
1. Create payment
   - Amount
   - Return URL
   - Webhook URL
   - Get payment URL

2. Webhooks:
   - `payment.succeeded` - Payment confirmed
   - `payment.failed` - Payment failed
   - `payment.refunded` - Payment refunded

**Security:**
- Webhook signature verification
- Store PayPlug API key in environment

### Scaleway Object Storage

**S3-compatible API**

**Bucket structure:**
```
npl-conventions/
├── lettres-mission/
│   └── {dossierId}/
│       ├── generated.pdf
│       └── signed.pdf
```

**Operations:**
- Upload PDF after generation
- Upload signed PDF from firma.dev
- Generate signed URLs for download (expiring links)

---

## Security & Compliance

### Authentication
- Simple API key authentication (MVP)
- Header: `X-API-Key: {key}`
- Guard: `ApiKeyGuard`
- Future: JWT + role-based access

### Data Protection (RGPD)
- All PII encrypted at rest (database encryption)
- Secure object storage (EU-hosted)
- Audit trail via WebhookEvent table
- Client data deletion policy

### Webhook Security
- Verify all webhook signatures
- Log all webhook events
- Idempotency handling (prevent duplicate processing)

### Error Handling
- Never expose internal errors to clients
- Log all errors with correlation IDs
- Graceful degradation for external service failures

---

## Environment Configuration

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/npl_conventions

# Node
NODE_ENV=production
PORT=3000

# Security
API_KEY=your-secret-api-key

# firma.dev
FIRMA_API_KEY=your-firma-api-key
FIRMA_WEBHOOK_SECRET=your-firma-webhook-secret
FIRMA_API_URL=https://api.firma.dev

# PayPlug
PAYPLUG_API_KEY=your-payplug-api-key
PAYPLUG_WEBHOOK_SECRET=your-payplug-webhook-secret
PAYPLUG_API_URL=https://api.payplug.com

# Scaleway Object Storage
S3_ENDPOINT=https://s3.fr-par.scw.cloud
S3_REGION=fr-par
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=npl-conventions

# Application
APP_URL=https://your-app.com
CLIENT_RETURN_URL=https://your-app.com/payment/return
```

---

## Dependencies

### Core
```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@prisma/client": "^5.0.0",
    "puppeteer": "^21.0.0",
    "@aws-sdk/client-s3": "^3.400.0",
    "@aws-sdk/s3-request-presigner": "^3.400.0",
    "axios": "^1.5.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  }
}
```

---

## Verification Approach

### Testing Strategy

1. **Unit Tests**
   - Service layer logic
   - PDF generation
   - Webhook signature verification

2. **Integration Tests**
   - Database operations (Prisma)
   - External API mocking (firma.dev, PayPlug)
   - Workflow state transitions

3. **E2E Tests**
   - Complete workflow: creation → signature → payment
   - Webhook handling

### Manual Verification

1. Create a client
2. Create a dossier
3. Generate lettre mission PDF
4. Send for signature (use firma.dev test mode)
5. Simulate signature webhook
6. Choose payment method
7. Simulate payment webhook (PayPlug test mode)
8. Verify dossier status = PAID

### Linting & Type Checking

```bash
npm run lint
npm run format
npm run typecheck
```

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] PostgreSQL database provisioned
- [ ] Prisma migrations run
- [ ] S3 bucket created and configured
- [ ] firma.dev account configured with webhook URLs
- [ ] PayPlug account configured with webhook URLs
- [ ] Puppeteer dependencies installed (Chrome)
- [ ] API key generated and secured
- [ ] Health check endpoint available
- [ ] Logging and monitoring configured

---

## Known Limitations & Future Improvements

### MVP Limitations
- No UI (API only)
- Simple API key auth
- No multi-cabinet support
- No accounting integration
- No CARPA integration
- Manual check tracking only

### Future Enhancements
- Admin UI (React/Vue)
- Client portal (view documents, make payment)
- Role-based authentication
- Email notifications
- SMS notifications
- Advanced reporting
- Accounting export (CSV, API)
- Multi-cabinet support
- Payment plan management (installments tracking)

---

## Key Technical Decisions

### Why Puppeteer over Playwright?
- More mature ecosystem for PDF generation
- Better font rendering for legal documents
- Smaller footprint

### Why firma.dev over DocuSign?
- EU-based
- Simpler API
- Better pricing for SMB

### Why Scaleway over AWS?
- EU sovereignty
- RGPD compliance native
- Competitive pricing

### Why simple API key over JWT?
- MVP scope (internal tool)
- Single cabinet (no multi-user complexity)
- Can upgrade later without major refactor

---

## Success Criteria

The system is successful when:
1. A developer can clone, configure, and run the project in < 30 minutes
2. The complete workflow (creation → signature → payment) works end-to-end
3. All business rules are enforced (no payment before signature, etc.)
4. Webhook handling is robust and idempotent
5. Legal compliance is verifiable (audit trail)
6. Code is maintainable and well-documented

---

## Next Steps

See detailed implementation plan in `plan.md`.
