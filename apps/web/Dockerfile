# ============================================================
# Base stage: common foundation for all stages
# ============================================================
FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /app

# ============================================================
# Deps stage: install all workspace dependencies
# ============================================================
FROM base AS deps

# Copy workspace manifests for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy package.json files only — avoids cache busting on source changes
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile

# ============================================================
# Development stage: Next.js dev server with hot reload
# ============================================================
FROM base AS development

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY . .

WORKDIR /app/apps/web

EXPOSE 3000

ENV NEXT_TELEMETRY_DISABLED=1

CMD ["pnpm", "dev"]

# ============================================================
# Builder stage: compile production Next.js bundle
# ============================================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Build shared packages first
RUN pnpm run build --filter=@flux/shared 2>/dev/null || true

# Build the Next.js app
RUN pnpm run build --filter=web

# ============================================================
# Production stage: standalone Next.js server, non-root user
# ============================================================
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy the standalone output produced by Next.js (requires output: 'standalone' in next.config.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
