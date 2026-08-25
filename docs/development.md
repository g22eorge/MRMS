# Development

Everything runs in containers, including the database. There is no host
toolchain to set up beyond Docker.

```bash
bun run dev:up        # build and start; app on http://localhost:3000
bun run dev:logs      # follow the app
bun run dev:down      # stop, keep data
```

First run also wants data:

```bash
bun run dev:seed      # demo data (or: dev:up then `exec app bun run seed:base`)
```

## Editing code

**Nothing needs restarting.** The working tree is bind-mounted into the
containers:

| Service | How it reloads |
| --- | --- |
| `app` | Next's dev server. Measured: an edit on the host is served by the container **2 seconds later**, in both directions |
| `worker` | `bun --watch lib/queue/worker.ts` — restarts on any file it imports |
| `scheduler` | `node --watch scripts/scheduler.mjs` |

The one exception is `prisma/schema.prisma`. The client is generated inside the
container, so after a schema change:

```bash
bun run dev:migrate   # prisma migrate dev, in the container
```

or `bun run dev:up` again, which regenerates on start.

## What runs where

| Service | Port | Notes |
| --- | --- | --- |
| `app` | 3000 | `next dev`, bound to 0.0.0.0 so the host can reach it |
| `postgres` | 5433 | The database you develop against |
| `postgres-scratch` | 5434 | Tests, QA scripts and import rehearsals — never your dev data |
| `redis` | internal | Queue backend |
| `worker` | — | BullMQ worker |
| `scheduler` | — | The four cron jobs, on their real schedules |

Both databases publish a port, so host tools still work:

```bash
psql "postgresql://mrms:mrms_dev_password@localhost:5433/mrms"
bun run pg:drift mrms-prod.db          # migration tooling, from the host
```

`bun run pg:up` starts **only** the two databases, for when you want the app on
the host instead.

## Running the checks

In the container, so results do not depend on a host toolchain:

```bash
bun run dev:check     # tsc + lint
bun run dev:test      # 508 unit tests, against postgres-scratch
bun run dev:sh        # a shell, for anything else
```

The host equivalents (`bunx tsc --noEmit`, `bun run test:unit`) still work,
because the database ports are published.

## Two things that will bite otherwise

**File watching polls.** Bind-mounted file events do not reach a container
reliably on macOS or Windows, so `WATCHPACK_POLLING` and `CHOKIDAR_USEPOLLING`
are set in `docker-compose.dev.yml`. That costs some idle CPU. On Linux, inotify
works through the mount — set both to `""` there.

**`node_modules` and `.next` are container volumes, not bind mounts.** A
bind-mounted `node_modules` would shadow the install baked into the image (and on
macOS is slow enough to be unusable), and sharing `.next` with host builds
corrupts Turbopack's on-disk cache. So `bun install` on the host does not affect
the container: after changing dependencies, run `bun run dev:up` to rebuild.

## Development secrets

`docker-compose.dev.yml` hardcodes `BETTER_AUTH_SECRET` and `CRON_SECRET` as
obvious development values, on purpose — there is nothing to protect on a local
machine, and a placeholder that fails closed would just mean nobody can log in.

Third-party credentials (WhatsApp, Resend, Pesapal, Anthropic) are read from
`.env` if it exists, so they live in one place. Everything environment-specific
is overridden by the compose file, because `environment` beats `env_file`.

## Production

Separate stack, separate compose project (`mrms` vs `mrms-dev`), so the two never
collide: see `docs/deployment.md`.
