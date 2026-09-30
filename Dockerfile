# syntax=docker/dockerfile:1.7
# FXT Employee ID Card System - production image (Next.js standalone output).
# glibc (Debian) base: sharp and @resvg/resvg-js ship prebuilt binaries for it.

ARG NODE_VERSION=24-bookworm-slim

# ---------- dependencies ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---------- migrator (one-shot: `docker compose run --rm migrate`) ----------
# Contains full dependencies + scripts to apply SQL migrations / seed reference data.
FROM build AS migrator
ENV NODE_ENV=production
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed"]

# ---------- runtime ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_DIR=/data/storage

RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app \
 && mkdir -p /data/storage && chown -R app:app /data

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 3000
VOLUME ["/data/storage"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
