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
cp .env.docker.example .env
# fill in the three secrets and the public URL:
openssl rand -base64 36 | tr -d '/+=' | cut -c1-40   # POSTGRES_PASSWORD
openssl rand -base64 48 | tr -d '/+=' | cut -c1-48   # BETTER_AUTH_SECRET
openssl rand -base64 48 | tr -d '/+=' | cut -c1-48   # CRON_SECRET
chmod 600 .env
docker compose up -d --build
docker compose logs -f app
```

`.env` is the single source of environment for the stack. Every application
service loads it wholesale with `env_file`, so a variable added there reaches the
containers without editing `docker-compose.yml`.

Four things compose sets itself, because `.env` must not decide them:

| | Why |
| --- | --- |
| `DATABASE_URL` | The containers reach Postgres at the hostname `postgres` on the compose network, never at `localhost`. Assembled from the `POSTGRES_*` values so the password lives in one place |
| `UPLOADS_DIR` | A path inside the container, backed by the `uploads` volume |
| `REDIS_URL` | Defaults to the bundled service; `.env` can override it to point elsewhere |
| `NODE_ENV` | Always `production` in an image built for production |

Compose fails fast on a missing `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_SECRET`,
`CRON_SECRET` or `POSTGRES_*` rather than starting a half-configured stack.

The `scheduler` service deliberately does **not** load `.env`: it only ticks a
clock and makes one authenticated HTTP call, so it has no reason to hold the
database credentials or any provider API key.

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

## Validating on the shared VPS before a domain is ready

Until a hostname is sorted, test the migration branch at the server's
`http://<server-ip>:<APP_PORT>` directly — the base `docker-compose.yml`
already publishes `APP_PORT` to the host, so no Traefik/domain setup is
needed for this phase. Set `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL` to that
`http://` address (not `https://` — there's no TLS yet, and BetterAuth reads
the scheme off this URL to decide the cookie's `Secure` flag, so `https` here
would break login over plain HTTP).

`.github/workflows/deploy-migration-staging.yml` automates this: on push to
`feat/postgres-docker-migration` (or manually via `workflow_dispatch`), it
runs the quality gate, then SSHes into the server and runs the same
`git pull && docker compose up -d --build` from "Releasing a change" below.
It never touches `main`, and builds happen on the server itself rather than
in CI + a registry (simplest for infrequent validation deploys — revisit if
that build load starts competing with eaglestays on deploys, given the
capacity note below). See the workflow file for the one-time manual setup
(git clone on the server, `.env`, and the GitHub repo secrets it needs).

Once a hostname is ready, move to `docker-compose.shared-edge.yml` below —
that's the point at which the shared Traefik proxy and a real domain take
over from the raw `IP:PORT`.

## Sharing a server with another site

`docker-compose.yml` alone assumes MRMS owns the whole VPS: `app` publishes
`APP_PORT` directly and expects its own reverse proxy in front. That breaks the
moment the box already runs another site behind a shared TLS-terminating
proxy, because two proxies cannot both bind 80/443.

If the target VPS already runs a shared Traefik "edge" stack for other sites
(the pattern documented on the eaglestays server — one Traefik container owns
80/443, every site joins its external `edge` Docker network and is routed by
`Host()` label rules), use the overlay instead of the base file alone:

```bash
docker network create edge || true      # once, if it does not exist yet
cp .env.docker.example .env             # fill it in, plus MRMS_HOSTNAME
docker compose -f docker-compose.yml -f docker-compose.shared-edge.yml up -d --build
```

This drops `app`'s host-port publish (Traefik reaches it over the `edge`
network instead, so nothing on the box competes for a host port) and adds the
Traefik router labels, keyed off `MRMS_HOSTNAME` in `.env`.

**Validating the migration before it takes over the real domains.** Set
`MRMS_HOSTNAME` to a staging subdomain first, not `care.`/`app.eagleinfosolutions.com`
— those still point at the current production (Vercel) until this stack is
confirmed. Also add the staging hostname to `BETTER_AUTH_TRUSTED_ORIGINS` in
`.env` (comma-separated) so BetterAuth accepts it. Cutting over later is just
changing `MRMS_HOSTNAME` to the real domain, updating DNS, and restarting the
`app` service to pick up the new Traefik label — the same running stack and
data throughout, no move required.

**Capacity.** A box already running one database-backed app (Postgres +
app server + a scheduler, say) has little room for a second — check that
server's own capacity notes before adding this stack to it. Every MRMS service
in `docker-compose.yml` carries an explicit CPU/memory limit for exactly this
reason, but on a genuinely tight box treat this as a time-boxed validation
deployment and plan to move to a larger box before it carries real traffic.
Watch `docker stats` after deploying.

**Volumes and networks don't collide by name** — `docker-compose.yml` sets
`name: mrms`, so its named volumes and default network are prefixed `mrms_*`
regardless of what else runs on the box. Only the `edge` network is shared,
and it's declared `external`, so `docker compose down` here never touches it
or the other sites attached to it.

## Local development

Development runs entirely in containers too — see `docs/development.md`.

```bash
bun run dev:up     # app on http://localhost:3000, with live reload
```

It is a separate compose project (`mrms-dev`) from the production stack
(`mrms`), so the two can run side by side without colliding.
