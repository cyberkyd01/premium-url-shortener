# Premium URL Shortener — production image
# Build:  docker build -t premium-url-shortener .
# Run:    docker run -p 3000:3000 --env-file .env -v pus-data:/app/prisma/data -v pus-uploads:/app/public/uploads premium-url-shortener
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl && corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ---- dependencies ---------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile

# ---- build ----------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder DATABASE_URL so `prisma generate` and `next build` succeed without a live DB.
ENV DATABASE_URL="file:./data/app.db"
RUN pnpm prisma generate && pnpm next build

# ---- runtime --------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:./data/app.db"
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/next.config.ts /app/prisma.config.ts /app/tsconfig.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/src ./src
RUN mkdir -p /app/prisma/data /app/public/uploads /app/storage/backups && chown -R app:app /app/prisma/data /app/public/uploads /app/storage
USER app
# Persist the SQLite database, uploads and backups.
VOLUME ["/app/prisma/data", "/app/public/uploads", "/app/storage"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -q --spider http://127.0.0.1:3000/ || exit 1
# Push the schema (creates the SQLite file on first boot, applies changes on upgrades), seed defaults, then start.
CMD ["sh", "-c", "pnpm prisma db push --skip-generate --accept-data-loss && (pnpm tsx prisma/seed.ts || true) && pnpm next start -p ${PORT}"]
