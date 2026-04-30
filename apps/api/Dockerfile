# ============================================================
# Base stage: common foundation for all stages
# ============================================================
FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat openssl

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app

# ============================================================
# Deps stage: install all workspace dependencies
# ============================================================
FROM base AS deps

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy all package.json files from workspace packages before install
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile

# ============================================================
# Development stage: hot-reload dev server
# ============================================================
FROM base AS development

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY . .

WORKDIR /app/apps/api

RUN pnpm prisma generate 2>/dev/null || true

EXPOSE 3001

CMD ["pnpm", "start:dev"]

# ============================================================
# Builder stage: compile TypeScript for production
# ============================================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared packages first, then the API
RUN pnpm run build --filter=@flux/shared && \
    pnpm run build --filter=api

# Prune dev dependencies — keep only production deps
RUN pnpm deploy --filter=api --prod /app/api-deploy

# ============================================================
# Production stage: minimal runtime image
# ============================================================
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/api-deploy/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

USER nestjs

EXPOSE 3001

ENV NODE_ENV=production \
    PORT=3001

CMD ["node", "dist/main.js"]
