# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Company Flux** is a Brazilian B2B FinTech SaaS (cash-flow management) built as a pnpm + Turborepo monorepo with three packages:

| Package | Tech | Port |
|---|---|---|
| `apps/api` | NestJS 10, Prisma 5, PostgreSQL 16, Redis/BullMQ | 3001 |
| `apps/web` | Next.js 14 (App Router), TanStack Query, Zustand, Tailwind | 3000 |
| `packages/shared` | Pure TypeScript — types, Zod schemas, constants | – |

---

## Commands

All commands below are run from the **repo root** unless noted.

### Development
```bash
# Start all services (requires Docker for Postgres/Redis)
docker compose up -d postgres redis mailhog bull-board
pnpm dev                    # runs api + web in parallel via Turborepo

# Per-app dev
pnpm --filter @flux/api start:dev
pnpm --filter @flux/web dev
```

### Build & Type-check
```bash
pnpm build                  # full monorepo build (respects dependency order)
pnpm typecheck              # tsc --noEmit across all packages
pnpm lint                   # ESLint across all packages
pnpm format                 # Prettier write
pnpm format:check           # Prettier check (used in CI)
```

### Tests
```bash
pnpm test                   # all packages
pnpm test:cov               # with coverage

# Single test file (from apps/api):
pnpm --filter @flux/api exec jest src/modules/auth/auth.service.spec.ts
```

### Prisma (run from `apps/api`)
```bash
pnpm --filter @flux/api prisma:generate   # regenerate client after schema changes
pnpm --filter @flux/api prisma:migrate    # apply migrations (dev)
pnpm --filter @flux/api prisma:seed       # seed database
```

### Environment setup
Copy and fill:
- `apps/api/.env.example` → `apps/api/.env`
- `apps/web/.env.example` → `apps/web/.env`

Generate JWT secrets with `openssl rand -hex 64`. Generate the encryption key with `openssl rand -hex 32`.

---

## Architecture

### Multi-Tenancy (Row-Level Isolation)

All tenant-scoped data (transactions, invoices, suppliers, etc.) is isolated at the Prisma middleware layer — **not** at the SQL schema level.

**Flow:**
1. `TenantResolutionMiddleware` (`apps/api/src/common/middleware/tenant-resolution.middleware.ts`) extracts `tenantId` from (in priority order): `X-Tenant-Id` header → subdomain → JWT payload.
2. `TenantContextInterceptor` stores `tenantId`, `userId`, `userRole`, and `planType` into `AsyncLocalStorage` (`tenantContext`).
3. `PrismaService` (`apps/api/src/modules/prisma/prisma.service.ts`) has a middleware that **automatically injects `tenantId`** into every read/write/create/delete query for the models in `TENANT_SCOPED_MODELS`. Services never need to manually add `where: { tenantId }` — the middleware does it.

**Critical:** When bypassing this middleware (e.g., background queue processors), pass `tenantId` explicitly in Prisma queries.

### Authentication

- **Access token**: short-lived JWT (15m default), contains `{ sub: userId, tenantId, role }`.
- **Refresh token**: random 64-byte hex, stored **hashed** (SHA-256) in `refresh_tokens` table. Rotation on every refresh (old token revoked, new issued).
- The web `api-client.ts` reads tokens from `localStorage` key `flux-auth-store` (Zustand persist), injects the `Authorization: Bearer` header on every request, and handles 401s with a queued refresh flow to avoid concurrent refresh races.

### Plan-Gating

Use the `createPlanGuard(feature)` factory (`apps/api/src/common/guards/plan.guard.ts`) as a route-level guard. It checks the tenant's active `Subscription` against `PLAN_LIMITS` from `@flux/shared`. Feature keys are the `PlanLimits` type keys (e.g., `hasAiInsights`, `maxBankAccounts`).

### Background Queues (BullMQ)

Two named queues backed by Redis:
- **`nf-processing`**: processes uploaded NF-e XML/PDF invoices. On success, attempts to auto-match a supplier by CNPJ and auto-create an expense transaction.
- **`audit-log`**: receives audit events from `AuditLogInterceptor` (fires on all mutating HTTP methods asynchronously — failures are swallowed to never break the request).

The Bull Board UI runs at `http://localhost:3002` in local dev.

### `packages/shared`

The only package imported by both `apps/api` and `apps/web`. Contains:
- `PLAN_LIMITS` and `PlanType` enum — the single source of truth for feature gating.
- Zod schemas used for API validation DTOs (`@flux/api`) and form validation (`@flux/web`).
- TypeScript types shared across the boundary.

Import as `@flux/shared`. Changes here require rebuilding (`pnpm build`) before either app picks them up.

### Web State Management

- **Zustand** (`useAuthStore`): persists `user`, `tenant`, `accessToken`, `refreshToken`, and `role` to `localStorage` as `flux-auth-store`. The axios interceptor reads directly from this key.
- **TanStack Query**: all server data (transactions, suppliers, dashboard, etc.) — cache invalidation is the primary mechanism for refetching after mutations.

### Next.js App Router Layout

- `(auth)` route group: unauthenticated pages (login, register, forgot-password, invite accept).
- `(dashboard)` route group: all authenticated pages, wrapped by `DashboardShell` → `Sidebar`.
- `onboarding/page.tsx`: post-registration step before the user reaches the dashboard.

### Infrastructure (local dev via Docker Compose)

| Service | Purpose | Access |
|---|---|---|
| `postgres` | PostgreSQL 16 | `localhost:5432` |
| `redis` | BullMQ queues + throttler storage | `localhost:6379` |
| `mailhog` | SMTP catch-all for dev emails | `localhost:8025` (UI) |
| `bull-board` | Queue monitoring UI | `localhost:3002` |

---

## Instruções de Memória

Claude pode evoluir e atualizar seus dados/memórias armazenados quando receber uma solicitação para isso. Ao receber tal solicitação, deve responder à pergunta: **"Por que você faz isso e pelo que?"** antes de executar a atualização.

### Economia de Tokens

Sempre fazer perguntas de esclarecimento sobre o assunto/requisito **antes** de implementar, para economizar tokens desnecessários. Registrar dados e decisões importantes no CLAUDE.md para manter memória persistente do projeto.

### Contagem de Mensagens

Contabilizar e apresentar na tela o número de mensagens da conversa em cada resposta:
- Mostrar formato: `📊 Mensagens: [N/15]` no final de cada resposta
- Se atingir 15 mensagens → notificar "Limite de 15 mensagens atingido - documentação enviada"
- **Ao chegar a 13 mensagens**: Hook `auto-compact-at-13` dispara e alerta para executar `/compact`
- Hook configurado em `.claude/settings.json` → dispara em `UserPromptSubmit`
- Útil para rastrear contexto da conversa e economia de tokens
