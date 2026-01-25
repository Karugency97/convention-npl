# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NPL Convention Management System - Internal system for NPL Law Firm to manage engagement letters (lettres de mission), electronic signatures, and payment processing.

## Tech Stack

- **Backend**: NestJS (Node.js 20+) with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **PDF Generation**: Puppeteer with Handlebars templates
- **Storage**: S3-compatible object storage (Scaleway/OVH)
- **Frontend**: React 19 + Vite + TanStack Query
- **External Integrations**: firma.dev (e-signatures), PayPlug (payments)

## Common Commands

### Backend (root directory)

```bash
npm run start:dev              # Development with hot reload
npm run build && npm run start:prod  # Production mode

npm run lint                   # ESLint with auto-fix
npm run format                 # Prettier formatting

npm run test                   # Unit tests
npm run test:watch             # Unit tests in watch mode
npm run test:cov               # Coverage report
npm run test:e2e               # E2E tests (requires test database)
```

Run single test: `npm test -- path/to/file.spec.ts`

### Database (Prisma)

```bash
npx prisma generate            # Regenerate Prisma Client after schema changes
npx prisma migrate dev         # Create and apply migrations in development
npx prisma studio              # Database GUI
```

### Frontend (frontend/ directory)

```bash
cd frontend
npm run dev                    # Vite dev server
npm run build                  # TypeScript check + Vite build
npm run preview                # Preview production build locally
```

## Architecture

### Module Structure

The backend follows NestJS modular architecture. Each domain module contains:
- `*.module.ts` - Module definition with imports/exports
- `*.controller.ts` - HTTP endpoints
- `*.service.ts` - Business logic
- `dto/*.dto.ts` - Request/response validation with class-validator

### Core Modules

- **PrismaModule** - Database access, injectable `PrismaService`
- **StorageModule** - S3 operations, file upload/download with presigned URLs
- **ClientsModule** - Client CRUD
- **DossiersModule** - Case management with status tracking
- **LettreMissionModule** - PDF generation from HTML templates via Puppeteer
- **SignatureModule** - firma.dev integration, webhook handling
- **PaiementModule** - PayPlug online payments + check tracking

### Business Workflow

Dossier status progression:
`DRAFT` → `SENT` (signature sent) → `SIGNED` → `PAYMENT_PENDING` (PayPlug) or `PAID` (checks/completed)

### Authentication

- Global `ApiKeyGuard` protects all endpoints except webhooks
- Use `@Public()` decorator (from `src/common/decorators/public.decorator.ts`) to bypass authentication
- API key passed via `X-API-Key` header

### Webhooks

Webhook endpoints at `/webhooks/firma` and `/webhooks/payplug`:
- Must be marked with `@Public()` decorator
- Verify signatures using HMAC-SHA256 with timing-safe comparison
- Idempotent processing via `WebhookEvent` table (checks `event_id` before processing)

firma.dev event types: `signing_request.completed`, `signing_request.cancelled`, `signing_request.expired`

### Database Transactions

Use `prisma.$transaction([...])` for atomic multi-table updates. Example pattern from signature service:
```typescript
await this.prisma.$transaction([
  this.prisma.lettreMission.update({ where: {...}, data: {...} }),
  this.prisma.dossier.update({ where: {...}, data: {...} }),
]);
```

### Configuration

Environment validation in `src/config/env.validation.ts` using class-validator. All variables validated at startup.

Required: `DATABASE_URL`, `API_KEY`, `S3_*`, `FIRMA_*`, `PAYPLUG_*`, `APP_URL`, `FRONTEND_URL`

### PDF Generation

- HTML templates in `src/lettre-mission/templates/`
- Handlebars templating with `{{{variable}}}` syntax (triple braces for unescaped HTML)
- Puppeteer renders HTML to PDF

## Testing

- Unit tests: `*.spec.ts` files colocated with source
- E2E tests: `test/*.e2e-spec.ts` with supertest
- Test database: Separate PostgreSQL via `DATABASE_URL` override
- Mock providers: `test/utils/mock-providers.ts`

## Production Deployment (Dokploy)

### URLs
- **Production**: https://convention.nplavocat.com/
- **Alternative**: https://convention-npl-31-97-156-140.traefik.me/

### Infrastructure
- **Platform**: Dokploy on Hostinger VPS
- **Docker Image**: `node:20-bullseye-slim` (required for Prisma OpenSSL 1.1.x)
- **Database**: PostgreSQL (convention-npl-postgres-hsrobt)
- **API Key**: Configured via `API_KEY` env var, passed in `X-API-Key` header

### Deployment Files
- `Dockerfile` - Multi-stage build (NestJS backend + React frontend)
- `docker-entrypoint.sh` - Runs Prisma migrations before starting app
- `.dockerignore` - Optimized Docker context

### Key Configuration
- Frontend served via `ServeStaticModule` from `/dist/public`
- Prisma migrations in `prisma/migrations/` - auto-applied on container start
- CORS configured for `FRONTEND_URL`

### Environment Variables (Production)
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
API_KEY=<secure-key>
APP_URL=https://convention.nplavocat.com
FRONTEND_URL=https://convention.nplavocat.com
```

### Secrets to Configure
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` - Object storage
- `FIRMA_WEBHOOK_SECRET` - Signature webhook verification
- `PAYPLUG_API_KEY` / `PAYPLUG_WEBHOOK_SECRET` - Payment processing
