# Implementation Plan: NPL Convention Management System

## Configuration
- **Artifacts Path**: `.zenflow/tasks/convention-npl-6f76`
- **Complexity**: HARD
- **Estimated Duration**: 15-20 hours

---

## Workflow Steps

### [x] Step: Technical Specification

Created comprehensive technical specification including:
- Data model (Prisma schema)
- Architecture and module structure
- API endpoints
- Business workflow
- Integration details (firma.dev, PayPlug, S3)
- Security and compliance approach

**Output**: `spec.md`

---

### [x] Step 1: Project Setup & Configuration
<!-- chat-id: d7b396bc-8703-4ada-9305-9387ac95fde6 -->

**Objective**: Initialize NestJS project with all dependencies and configuration.

**Tasks**:
1. Initialize NestJS project
2. Install all dependencies (Prisma, Puppeteer, AWS SDK, etc.)
3. Configure TypeScript
4. Set up ESLint and Prettier
5. Create `.env.example` and environment validation
6. Set up `.gitignore` (node_modules, dist, .env, etc.)
7. Create basic project structure (modules folders)

**Verification**:
- `npm install` completes successfully
- `npm run build` compiles without errors
- Environment validation works

**Files Created/Modified**:
- `package.json`
- `tsconfig.json`
- `.eslintrc.js`
- `.prettierrc`
- `.env.example`
- `.gitignore`
- `src/main.ts`
- `src/app.module.ts`
- `src/config/*`

---

### [x] Step 2: Database Setup & Prisma Configuration
<!-- chat-id: b2b2008d-8dd3-4c76-8f93-6ab1cc0528fc -->

**Objective**: Set up PostgreSQL, configure Prisma, and create all models.

**Tasks**:
1. Create Prisma schema with all models (Client, Dossier, LettreMission, Paiement, Cheque, WebhookEvent)
2. Set up Prisma module and service
3. Create initial migration
4. Test database connection
5. Generate Prisma client

**Verification**:
- `npx prisma migrate dev` runs successfully
- `npx prisma studio` opens and shows all tables
- Database connection established

**Files Created/Modified**:
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `src/prisma/prisma.module.ts`
- `src/prisma/prisma.service.ts`

---

### [x] Step 3: Clients Module (CRUD)
<!-- chat-id: a6b49bc7-469a-49c2-9a13-90027b578592 -->

**Objective**: Implement complete client management functionality.

**Tasks**:
1. Create Clients module, controller, service
2. Implement DTOs (CreateClientDto, UpdateClientDto)
3. Implement all CRUD operations
4. Add validation
5. Add error handling

**API Endpoints**:
- `POST /clients`
- `GET /clients`
- `GET /clients/:id`
- `PATCH /clients/:id`
- `DELETE /clients/:id`

**Verification**:
- All endpoints work via REST client (Postman/Insomnia)
- Validation errors are properly returned
- Database records created/updated correctly

**Files Created/Modified**:
- `src/clients/*`

---

### [x] Step 4: Dossiers Module (CRUD)
<!-- chat-id: b362f3e1-d98e-4871-9689-0c274de8326b -->

**Objective**: Implement dossier management with status tracking.

**Tasks**:
1. Create Dossiers module, controller, service
2. Implement DTOs (CreateDossierDto, UpdateDossierDto)
3. Implement all CRUD operations
4. Add status management logic
5. Add client relationship validation
6. Implement reference number generation (DOS-YYYY-XXX)

**API Endpoints**:
- `POST /dossiers`
- `GET /dossiers` (with filters by status, client)
- `GET /dossiers/:id` (includes lettre mission, paiements)
- `PATCH /dossiers/:id`
- `DELETE /dossiers/:id` (only DRAFT)

**Verification**:
- Dossiers can be created for existing clients
- Reference numbers are unique and auto-generated
- Status transitions are tracked
- Cannot delete non-DRAFT dossiers

**Files Created/Modified**:
- `src/dossiers/*`

---

### [x] Step 5: Storage Service (S3 Integration)
<!-- chat-id: 0595ac72-a85e-423d-a54e-7276e41dfa25 -->

**Objective**: Implement S3-compatible object storage for PDFs.

**Tasks**:
1. Create Storage module and service
2. Implement upload method
3. Implement download method
4. Implement signed URL generation (temporary access)
5. Configure Scaleway Object Storage connection
6. Test with sample file

**Methods**:
- `uploadFile(key: string, buffer: Buffer, contentType: string)`
- `getSignedDownloadUrl(key: string, expiresIn: number)`
- `deleteFile(key: string)`

**Verification**:
- Files can be uploaded to S3
- Signed URLs work and expire correctly
- Files can be deleted

**Files Created/Modified**:
- `src/storage/*`

---

### [x] Step 6: PDF Generation Service

**Objective**: Generate PDFs from HTML templates using Puppeteer.

**Tasks**:
1. Create PDF generator service
2. Create HTML template for lettre de mission
3. Implement template variable injection (Handlebars or EJS)
4. Configure Puppeteer for PDF generation
5. Test PDF output quality
6. Handle French characters and legal formatting

**Methods**:
- `generateLettreMissionPdf(templateData: any): Promise<Buffer>`

**Verification**:
- PDF is generated with correct formatting
- All variables are properly injected
- French characters render correctly
- PDF is suitable for legal use (A4, proper margins)

**Files Created/Modified**:
- `src/lettre-mission/pdf-generator.service.ts`
- `src/lettre-mission/templates/convention.html`

---

### [x] Step 7: Lettre Mission Module (Creation & Generation)

**Objective**: Implement lettre mission creation and PDF generation.

**Tasks**:
1. Create LettreMission module, controller, service
2. Implement CreateLettreMissionDto
3. Create endpoint to generate lettre mission
4. Integrate PDF generator service
5. Upload generated PDF to S3
6. Store metadata in database

**API Endpoints**:
- `POST /dossiers/:dossierId/lettre-mission`
- `GET /dossiers/:dossierId/lettre-mission`
- `GET /dossiers/:dossierId/lettre-mission/pdf`

**Verification**:
- Lettre mission can be created for a dossier
- PDF is generated and stored in S3
- PDF can be downloaded via signed URL
- Template data is stored as JSON

**Files Created/Modified**:
- `src/lettre-mission/*`

---

### [x] Step 8: Signature Service (firma.dev Integration)

**Objective**: Integrate firma.dev for e-signatures.

**Tasks**:
1. Create Signature service
2. Implement firma.dev API client (upload, create signature request)
3. Implement send for signature endpoint
4. Store firma signature ID in database
5. Update dossier status to SENT
6. Handle firma.dev errors

**API Endpoint**:
- `POST /dossiers/:dossierId/lettre-mission/send`

**Verification**:
- PDF is sent to firma.dev
- Client receives signature email (in test mode)
- Signature ID is stored correctly
- Dossier status updates to SENT

**Files Created/Modified**:
- `src/signature/signature.service.ts`
- `src/signature/signature.module.ts`

---

### [x] Step 9: Signature Webhooks (firma.dev)

**Objective**: Handle firma.dev webhooks for signature completion.

**Tasks**:
1. Create webhook controller for firma.dev
2. Implement webhook signature verification
3. Handle `signature.completed` event
4. Download signed PDF from firma.dev
5. Upload signed PDF to S3
6. Update LettreMission record
7. Update Dossier status to SIGNED
8. Log webhook events to WebhookEvent table
9. Implement idempotency (prevent duplicate processing)

**API Endpoint**:
- `POST /webhooks/firma`

**Verification**:
- Webhook signature is verified
- Signed PDF is downloaded and stored
- Dossier status updates to SIGNED
- Duplicate webhooks are handled gracefully
- All events are logged

**Files Created/Modified**:
- `src/signature/signature-webhook.controller.ts`
- `src/signature/dto/firma-webhook.dto.ts`

---

### [x] Step 10: Payment Module - Core Setup

**Objective**: Set up payment module structure and choice endpoint.

**Tasks**:
1. Create Paiement module, controller, service
2. Create Cheques service
3. Implement payment choice endpoint
4. Validate that dossier is SIGNED before allowing payment choice
5. Implement business logic for PAYPLUG vs CHEQUES modes

**API Endpoint**:
- `POST /dossiers/:dossierId/paiement/choose`

**Verification**:
- Cannot choose payment if dossier not SIGNED
- Payment mode is validated
- Paiement record is created

**Files Created/Modified**:
- `src/paiement/paiement.module.ts`
- `src/paiement/paiement.controller.ts`
- `src/paiement/paiement.service.ts`
- `src/paiement/cheques.service.ts`
- `src/paiement/dto/create-paiement.dto.ts`

---

### [x] Step 11: PayPlug Integration

**Objective**: Integrate PayPlug for online payments.

**Tasks**:
1. Create PayPlug service
2. Implement PayPlug API client (create payment)
3. Handle payment creation for PAYPLUG mode
4. Generate payment URL for client redirect
5. Store PayPlug payment ID
6. Update dossier status to PAYMENT_PENDING
7. Handle PayPlug errors

**Methods**:
- `createPayment(amount: Decimal, metadata: any): Promise<PayPlugPayment>`

**Verification**:
- PayPlug payment is created (test mode)
- Payment URL is returned
- Client can be redirected to PayPlug
- Payment ID is stored

**Files Created/Modified**:
- `src/paiement/payplug.service.ts`

---

### [x] Step 12: PayPlug Webhooks

**Objective**: Handle PayPlug webhooks for payment confirmation.

**Tasks**:
1. Create webhook controller for PayPlug
2. Implement webhook signature verification
3. Handle `payment.succeeded` event
4. Update Paiement status to COMPLETED
5. Update Dossier status to PAID
6. Handle `payment.failed` event
7. Log webhook events to WebhookEvent table
8. Implement idempotency

**API Endpoint**:
- `POST /webhooks/payplug`

**Verification**:
- Webhook signature is verified
- Payment status updates correctly
- Dossier status updates to PAID
- Failed payments are handled
- Duplicate webhooks are handled gracefully

**Files Created/Modified**:
- `src/paiement/paiement-webhook.controller.ts`
- `src/paiement/dto/payplug-webhook.dto.ts`

---

### [x] Step 13: Cheques Management

**Objective**: Implement check payment tracking.

**Tasks**:
1. Implement check creation logic in payment choice
2. Validate total check amounts equal payment amount
3. Create endpoint to update check status
4. Create endpoint to list checks with filters
5. Auto-update Dossier to PAID when checks are registered
6. Handle status transitions (ATTENDU → RECU → ENCAISSE)

**API Endpoints**:
- `POST /paiements/:paiementId/cheques`
- `PATCH /cheques/:id/status`
- `GET /cheques` (with filters)

**Verification**:
- Checks can be created for a payment
- Total amounts are validated
- Check status can be updated manually
- Status transitions are tracked with dates
- Dossier is marked PAID when checks are registered

**Files Created/Modified**:
- `src/paiement/cheques.service.ts` (extended)
- `src/paiement/dto/create-cheque.dto.ts`

---

### [x] Step 14: Security & Authentication

**Objective**: Implement API key authentication and security best practices.

**Tasks**:
1. Create API key guard
2. Apply guard to all endpoints (except webhooks)
3. Implement webhook signature verification for all webhooks
4. Add request logging interceptor
5. Add global exception filter
6. Add input validation (class-validator)
7. Add rate limiting (optional but recommended)

**Verification**:
- Requests without API key are rejected (401)
- Webhooks without valid signature are rejected (401)
- All requests are logged
- Validation errors return 400 with details
- Exceptions are properly formatted

**Files Created/Modified**:
- `src/common/guards/api-key.guard.ts`
- `src/common/interceptors/logging.interceptor.ts`
- `src/common/filters/http-exception.filter.ts`

---

### [x] Step 15: End-to-End Testing
<!-- chat-id: 42c8d0b7-24e3-42b0-9e43-0a6d6c07be76 -->

**Objective**: Test the complete workflow from creation to payment.

**Implementation**:
- Created comprehensive E2E test suite with 18 tests in `test/workflow.e2e-spec.ts`
- Set up test configuration in `test/jest-e2e.json` and `test/setup.ts`
- Created test utilities in `test/utils/test-helpers.ts` for database cleanup and test data generation
- Created mock providers in `test/utils/mock-providers.ts` for external services (S3, PDF, PayPlug)

**Test Scenarios Implemented**:

1. **PayPlug Flow** (1 test):
   - Create client
   - Create dossier
   - Create lettre mission (PDF generated)
   - Send for signature (simulated)
   - Simulate firma.dev webhook (signature completed)
   - Choose PayPlug payment
   - Simulate PayPlug webhook (payment succeeded)
   - Verify dossier status = PAID

2. **Cheques Flow** (2 tests):
   - Create client → dossier → lettre mission → signature → cheques payment
   - Verify dossier status = PAID
   - Test cheque status updates (ATTENDU → RECU → ENCAISSE)

3. **Error Cases** (7 tests):
   - Reject payment before signature
   - Reject sending unsigned document
   - Reject duplicate lettre mission
   - Reject deleting non-DRAFT dossiers
   - Validate cheques total equals payment amount
   - Require cheques data when mode is CHEQUES
   - Reject duplicate payment choice

4. **API Key Authentication** (3 tests):
   - Reject requests without API key
   - Reject requests with invalid API key
   - Accept requests with valid API key

5. **Data Validation** (3 tests):
   - Reject invalid email format
   - Reject missing required fields
   - Reject negative lettre mission amounts

**Files Created/Modified**:
- `test/jest-e2e.json` - Updated E2E Jest configuration
- `test/setup.ts` - Test setup file
- `test/workflow.e2e-spec.ts` - Main E2E test file (18 tests)
- `test/app.e2e-spec.ts` - Updated app tests (2 tests)
- `test/utils/test-helpers.ts` - Test utilities
- `test/utils/mock-providers.ts` - Mock services for testing
- `test/.env.test` - Test environment configuration
- `package.json` - Added test:e2e:setup and test:e2e:ci scripts

**Verification**:
- All 18 E2E tests pass ✓
- All workflows complete successfully ✓
- Business rules are enforced ✓
- Error handling works correctly ✓
- Database state is consistent ✓

---

### [x] Step 16: Documentation & Deployment Preparation

**Objective**: Create comprehensive documentation and prepare for deployment.

**Tasks**:
1. Create detailed README.md
   - Project overview
   - Prerequisites
   - Installation steps
   - Configuration guide
   - API documentation (or link to Swagger)
   - Running the application
   - Testing
   - Deployment guide
2. Create `.env.example` with all variables
3. Document webhook URLs for firma.dev and PayPlug
4. Create deployment checklist
5. Add health check endpoint
6. Document known limitations

**Files Created/Modified**:
- `README.md`
- `.env.example`
- `DEPLOYMENT.md`

**Verification**:
- Another developer can follow README to set up locally
- All configuration is documented
- Deployment steps are clear

---

## Completion Criteria

The implementation is complete when:

- [ ] All 16 steps are completed
- [ ] All API endpoints work as specified
- [ ] Complete workflow (creation → signature → payment) works end-to-end
- [ ] Both payment modes (PayPlug and Cheques) are functional
- [ ] All business rules are enforced
- [ ] Webhook handling is robust and tested
- [ ] Security measures are in place
- [ ] Documentation is complete
- [ ] Code passes linting and type checking
- [ ] Project can be set up by another developer in < 30 minutes

---

## Notes

- Each step should be completed fully before moving to the next
- Mark steps as complete by changing `[ ]` to `[x]`
- If blockers are encountered, document them and ask for clarification
- Test each module independently before integration
- Use firma.dev and PayPlug test/sandbox modes during development
