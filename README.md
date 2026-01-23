# NPL Convention Management System

Internal system for NPL Law Firm to manage engagement letters (lettres de mission), electronic signatures, and payment processing.

## Features

- **Engagement Letter Generation**: Create and generate PDF engagement letters from HTML templates
- **Electronic Signature**: Integration with firma.dev for e-signatures
- **Payment Processing**: Support for PayPlug (online payments) and check tracking
- **Document Storage**: Secure S3-compatible object storage (EU-hosted)
- **Full Traceability**: Complete audit trail for legal compliance

## Tech Stack

- **Backend**: Node.js 20+ with NestJS
- **Database**: PostgreSQL with Prisma ORM
- **PDF Generation**: Puppeteer
- **Storage**: S3-compatible object storage (Scaleway/OVH)
- **Integrations**: firma.dev (signatures), PayPlug (payments)

## Prerequisites

- Node.js >= 20.11 (currently running on 20.9.0)
- PostgreSQL >= 14
- npm >= 8
- S3-compatible storage account (Scaleway, OVH, etc.)
- firma.dev account
- PayPlug account

## Installation

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure all required variables:

**Application**:
- `NODE_ENV`: Environment (development/production/test)
- `PORT`: API server port (default: 3000)
- `API_KEY`: Internal API key for authentication

**Database**:
- `DATABASE_URL`: PostgreSQL connection string

**Object Storage (S3)**:
- `S3_REGION`: Region (e.g., fr-par for Scaleway Paris)
- `S3_ENDPOINT`: S3 endpoint URL
- `S3_BUCKET`: Bucket name for document storage
- `S3_ACCESS_KEY_ID`: Access key
- `S3_SECRET_ACCESS_KEY`: Secret key

**firma.dev**:
- `FIRMA_API_KEY`: API key
- `FIRMA_API_URL`: API endpoint (https://api.firma.dev)
- `FIRMA_WEBHOOK_SECRET`: Webhook signature secret

**PayPlug**:
- `PAYPLUG_API_KEY`: API key
- `PAYPLUG_API_URL`: API endpoint (https://api.payplug.com)
- `PAYPLUG_WEBHOOK_SECRET`: Webhook signature secret

**URLs**:
- `APP_URL`: Backend URL
- `FRONTEND_URL`: Frontend URL (for CORS)

### 3. Set Up Database

Initialize Prisma and create the database:

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Build the Project

```bash
npm run build
```

## Running the Application

### Development Mode

```bash
npm run start:dev
```

### Production Mode

```bash
npm run build
npm run start:prod
```

## Project Structure

```
src/
├── clients/          # Client management module
├── dossiers/         # Case/dossier management module
├── lettre-mission/   # Engagement letter generation & management
├── signature/        # firma.dev integration & webhooks
├── paiement/         # Payment processing (PayPlug & checks)
├── storage/          # S3 storage service
├── prisma/           # Prisma database service
├── config/           # Configuration & environment validation
├── common/           # Shared guards, filters, interceptors
│   ├── guards/       # Authentication guards
│   ├── interceptors/ # Logging interceptors
│   └── filters/      # Exception filters
├── app.module.ts     # Root module
└── main.ts           # Application entry point
```

## API Documentation

### Base URL

```
http://localhost:3000
```

### Authentication

All endpoints (except webhooks) require an API key header:

```
X-API-Key: your-api-key
```

### Core Endpoints

**Clients**:
- `POST /clients` - Create client
- `GET /clients` - List clients
- `GET /clients/:id` - Get client details
- `PATCH /clients/:id` - Update client
- `DELETE /clients/:id` - Delete client

**Dossiers**:
- `POST /dossiers` - Create dossier
- `GET /dossiers` - List dossiers
- `GET /dossiers/:id` - Get dossier details
- `PATCH /dossiers/:id` - Update dossier

**Engagement Letters**:
- `POST /dossiers/:dossierId/lettre-mission` - Generate engagement letter
- `GET /dossiers/:dossierId/lettre-mission` - Get letter details
- `POST /dossiers/:dossierId/lettre-mission/send` - Send for signature

**Payments**:
- `POST /dossiers/:dossierId/paiement/choose` - Choose payment method
- `GET /paiements/:id` - Get payment details

**Webhooks**:
- `POST /webhooks/firma` - firma.dev signature webhooks
- `POST /webhooks/payplug` - PayPlug payment webhooks

## Business Workflow

1. **Create Client & Dossier**: Create a client and associated case/dossier
2. **Generate Engagement Letter**: Generate PDF from template with case details
3. **Send for Signature**: Upload PDF to firma.dev and send to client
4. **Signature Webhook**: firma.dev notifies when signed, system retrieves signed PDF
5. **Choose Payment**: Client chooses payment method (PayPlug or checks)
6. **Payment Confirmation**: 
   - PayPlug: Webhook confirms payment
   - Checks: Manual registration and tracking
7. **Dossier Completion**: Dossier marked as PAID

## Database Schema

See `prisma/schema.prisma` for complete data model:

- **Client**: Client information
- **Dossier**: Case/dossier with status tracking
- **LettreMission**: Engagement letter with PDF storage
- **Paiement**: Payment record (PayPlug or checks)
- **Cheque**: Individual check tracking
- **WebhookEvent**: Webhook audit log

## Development

### Code Quality

```bash
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
```

### Testing

```bash
npm run test          # Run unit tests
npm run test:e2e      # Run end-to-end tests
npm run test:cov      # Generate coverage report
```

### Database Management

```bash
npx prisma studio     # Open Prisma Studio (database GUI)
npx prisma migrate dev --name migration-name  # Create new migration
npx prisma generate   # Regenerate Prisma Client
```

## Security & Compliance

- **RGPD Compliance**: EU-hosted storage and processing
- **Legal Professional Secrecy**: Encrypted storage, audit trails
- **Authentication**: API key authentication for all endpoints
- **Webhook Verification**: Signature verification for all webhooks
- **Input Validation**: Comprehensive validation on all inputs
- **Error Handling**: Secure error messages (no sensitive data exposure)

## Deployment

### Environment Setup

1. Provision PostgreSQL database (France/EU)
2. Set up S3-compatible storage (Scaleway/OVH)
3. Configure firma.dev webhooks to point to your domain
4. Configure PayPlug webhooks to point to your domain
5. Set all environment variables in production

### Production Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] S3 bucket created with proper permissions
- [ ] Webhook URLs configured in firma.dev
- [ ] Webhook URLs configured in PayPlug
- [ ] SSL certificate configured
- [ ] API key rotation strategy in place
- [ ] Backup strategy configured
- [ ] Monitoring and logging configured

## Limitations (MVP)

- Single firm (Cabinet NPL only)
- Simple API key authentication
- No multi-user management
- No accounting integration
- No CARPA integration

## Support

For issues or questions, contact the development team.

## License

UNLICENSED - Internal use only for Cabinet NPL
