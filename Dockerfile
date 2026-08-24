# syntax=docker/dockerfile:1

# Two runtime images come out of this file:
#   --target runner   the Next.js server
#   --target migrator the Prisma CLI, for `migrate deploy` and seeding
#
# Both are Debian-based on purpose. Prisma ships per-platform query engines and
# its default build is debian-openssl-3.0.x; an Alpine runtime needs a musl
# engine declared in the schema's binaryTargets, which is a footgun that pays no
# dividend here.

# ── deps ────────────────────────────────────────────────────────────────────
FROM oven/bun:1-debian AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── build ───────────────────────────────────────────────────────────────────
FROM oven/bun:1-debian AS builder
WORKDIR /app
ENV NODE_ENV=production
# Marks this as a CI-style build: scripts/build.mjs then writes to .next rather
# than the .next-gate directory it uses to protect a local dev server.
ENV DOCKER_BUILD=1
# The datasource is postgresql, so the schema validates without a reachable
# database and the build needs no real connection string. This value is used for
# `prisma generate` only and never reaches the running container.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# ── migrator ────────────────────────────────────────────────────────────────
# Runs migrations and seeds. Kept separate from the app image so the server does
# not carry the Prisma CLI or the ability to alter the schema.
FROM oven/bun:1-debian AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY lib ./lib
# Operational input for scripts/pg/import.mjs: which columns are dropped and how
# duplicate keys are resolved.
COPY docs/pg-migration ./docs/pg-migration
# The generated client, so seed scripts run without a second `generate`.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
CMD ["bunx", "prisma", "migrate", "deploy"]

# ── runner ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# openssl for Prisma's query engine; curl for the healthcheck.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Run as a non-root user. node:22 ships uid/gid 1000 as `node`.
RUN mkdir -p /data/uploads && chown -R node:node /data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Next's dependency tracing does not reliably pull in Prisma's platform-specific
# query engine, so copy the generated client explicitly.
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/prisma ./prisma

USER node
EXPOSE 3000

# /api/health checks the database, so an unreachable database marks the
# container unhealthy rather than letting it serve 500s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]

# ── worker ──────────────────────────────────────────────────────────────────
# BullMQ worker. Needs the application source (it imports lib/*) and the
# generated client, but not the Next build output.
FROM oven/bun:1-debian AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY package.json bun.lock tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY lib ./lib
COPY app ./app
COPY components ./components
USER bun
CMD ["bun", "lib/queue/worker.ts"]

# ── scheduler ───────────────────────────────────────────────────────────────
# Replaces Vercel Cron. Only needs node and one script: it makes authenticated
# HTTP calls, so the work itself still happens inside the app.
FROM node:22-bookworm-slim AS scheduler
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node scripts/scheduler.mjs ./scripts/scheduler.mjs
USER node
CMD ["node", "scripts/scheduler.mjs"]

# ── backup ──────────────────────────────────────────────────────────────────
# pg_dump on a schedule. Based on the Postgres image so the client tools match
# the server major version exactly — a newer server refuses an older pg_dump.
FROM postgres:18-alpine AS backup
COPY scripts/pg-backup.sh /usr/local/bin/pg-backup
RUN chmod +x /usr/local/bin/pg-backup
CMD ["pg-backup"]
