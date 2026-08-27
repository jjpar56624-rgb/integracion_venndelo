# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# Remove dev dependencies
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-slim AS production

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nestjs

# Copy node_modules primero para usar la versión exacta de Playwright del proyecto
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package.json ./

# Instalar browsers con la versión de Playwright que está en node_modules
RUN node_modules/.bin/playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Asegurar que el directorio de browsers sea accesible
RUN chmod -R 755 /ms-playwright

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main"]
