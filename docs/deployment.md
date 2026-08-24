# Deployment — Docker on a single VPS

Everything runs in a container, database included. There is one compose file,
`docker-compose.yml`, and the VPS builds the images from a git checkout.

## Services

| Service | Image target | Purpose |
| --- | --- | --- |
| `postgres` | `postgres:18-alpine` | The database. Not published to the host — an exposed Postgres port on a VPS is scanned within hours |
| `migrate` | `migrator` | One-shot `prisma migrate deploy`, then exits. `app` waits for it to **succeed** |
| `app` | `runner` | The Next.js server, non-root, with a healthcheck against `/api/health` |
| `redis` | `redis:7-alpine` | Queue backend, append-only so a restart does not lose jobs |
| `worker` | `worker` | BullMQ worker |
| `scheduler` | `scheduler` | Replaces Vercel Cron — see below |
| `backup` | `backup` | `pg_dump` on a schedule into the `backups` volume |

## First deployment

```bash
git clone <repo> && cd MRMS
cp .env.docker.example .env      # fill in every value marked required
docker compose up -d --build
docker compose logs -f app
```

Compose fails fast on missing required values rather than starting a
half-configured stack.

The container speaks plain HTTP on `APP_PORT` (default 3000). Put a
TLS-terminating reverse proxy in front of it (Caddy or nginx) and set
`NEXT_PUBLIC_APP_URL` to the public HTTPS URL — BetterAuth uses it for cookies
and redirects, so a mismatch shows up as login loops.

## Loading data from the old SQLite/Turso database

The importer runs in the `migrate` image. Mount the dump read-only:

```bash
docker compose run --rm --no-deps \
  -v "$(pwd)/mrms-prod.db:/app/mrms-prod.db:ro" \
  migrate node scripts/pg/import.mjs mrms-prod.db --check
```

`--check` validates without writing: enum labels, dropped columns, orphan
foreign keys, unknown tables/columns, and unique-constraint violations. When it
reports clean:

```bash
docker compose run --rm --no-deps \
  -v "$(pwd)/mrms-prod.db:/app/mrms-prod.db:ro" \
  migrate node scripts/pg/import.mjs mrms-prod.db --truncate --resolve-duplicates

docker compose run --rm --no-deps migrate \
  node scripts/pg/verify-import.mjs docs/pg-migration/baseline.mrms-prod.json
docker compose run --rm --no-deps migrate bun scripts/pg/verify-business.ts
```

The importer refuses to write into a database that already holds rows unless
`--truncate` is given, so a mistyped `DATABASE_URL` cannot silently merge two
datasets.

## Releasing a change

```bash
git pull
docker compose up -d --build
```

`migrate` runs first and `app` only starts if it succeeds, so a failed migration
leaves the previous container serving rather than starting a new one against a
schema it does not match. Prisma takes a Postgres advisory lock while migrating,
so concurrent replicas serialise instead of racing.

## Scheduled jobs

On Vercel these were declared in `vercel.json` and invoked by Vercel Cron. That
file is gone; nothing outside the stack invokes them now, so the `scheduler`
service does. It holds the same four jobs on the same schedules (UTC) and calls
each route with `Authorization: Bearer $CRON_SECRET`:

| Schedule | Job |
| --- | --- |
| `0 7 * * *` | `whatsapp-retry` — drains the outbox retry queue |
| `0 6 * * *` | `subscription-lifecycle` |
| `30 2 * * *` | `data-heal` |
| `0 3 * * 0` | `audit-prune` |

Without this service all four stop **silently** — nothing errors, the outbox
simply never drains and audit logs grow without bound. Check it is alive:

```bash
docker compose logs scheduler | tail
```

## Backups

`pg_dump -Fc` into the `backups` volume every `BACKUP_INTERVAL` seconds,
retained for `BACKUP_KEEP_DAYS`. Dumps are written to a `.partial` name and
moved on success, so an interrupted dump can never be mistaken for a usable one.

**A backup on the same machine does not survive losing the machine.** Copy them
off:

```bash
docker compose cp backup:/backups ./backups-local
```

### Restore drill — do this before you need it

```bash
docker compose exec postgres psql -U mrms -d postgres -c 'CREATE DATABASE restore_drill'
docker compose exec backup pg_restore -d restore_drill --no-owner /backups/<file>.dump
docker compose exec postgres psql -U mrms -d restore_drill \
  -c 'SELECT COUNT(*) FROM "Job"' -c 'SELECT SUM("amount") FROM "Payment"'
docker compose exec postgres psql -U mrms -d postgres -c 'DROP DATABASE restore_drill'
```

Compare against the live database. This exact drill was run during the migration:
75 jobs and a payment total of 20,348,100.00 in both.

### Full restore

```bash
docker compose stop app worker scheduler
docker compose exec backup dropdb --if-exists mrms
docker compose exec backup createdb mrms
docker compose exec backup pg_restore -d mrms --no-owner /backups/<file>.dump
docker compose up -d
```

## Health

`/api/health` returns `{ok, db, uptime}` and **503** when the database is
unreachable, which is what the container healthcheck keys off. It is in
`PUBLIC_PATHS` in `proxy.ts` for that reason — while it was session-gated the
healthcheck only proved the server answered, not that it worked.

Verified behaviour: stopping `postgres` gives HTTP 503 immediately and Docker
marks the container `unhealthy` after its retries (~75s); restarting `postgres`
returns it to `healthy` within 30s.

```bash
docker compose ps                                  # STATUS column shows (healthy)
docker inspect --format '{{.State.Health.Status}}' mrms-app-1
```

## Local development

The application runs on the host; only the database is containerised:

```bash
bun run pg:up        # postgres on 5433, plus a scratch instance on 5434
bun run dev
```

`docker-compose.dev.yml` uses its own compose project (`mrms-dev`) so those
containers are never mistaken for part of the application stack. Ports are 5433
and 5434 rather than 5432 because a host Postgres commonly holds 5432 and the
collision is silent — you connect to the wrong server and believe the results.
