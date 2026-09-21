# Development

Everything runs in containers, including the database. There is no host
toolchain to set up beyond Docker.

## First run

Install Docker, then:

```bash
git clone <repo> && cd MRMS
bun install           # for editor tooling; the containers install their own
bun run dev:up        # build and start; app on http://localhost:3000
```

That is the whole setup. `dev:up` starts Postgres, Redis, the app, the worker
and the scheduler, applies the migrations, and gives you a database with data in
it. Watch it happen with `bun run dev:logs`.

Where that data comes from depends on what the repo carries — see
[Onboarding data](#onboarding-data). Without a prepared dump you get the demo
seed, described next.

You end up with 33 jobs, 15 clients, 10 invoices and an account for every role:

```
admin@eagle.test   manager@eagle.test   ops@eagle.test     frontdesk@eagle.test
tech1@eagle.test   tech2@eagle.test     exttech@eagle.test exttech2@eagle.test
finance@eagle.test sales@eagle.test
                    password for all: password123
```

Note the TLD. These are `.test` demo accounts. A database carrying imported
production data has different users entirely, on `@eagle.tech`, with production
password hashes — see below.

The seeding is `scripts/dev-bootstrap.mjs` and it is deliberately timid. It runs
on every container start, counts rows in the tables the seed guards on, and does
nothing at all if it finds any. Restarting never costs you your data, and it
cannot overwrite a database somebody has been working in.

```bash
bun run dev:logs      # follow the app
bun run dev:down      # stop, keep data
bun run dev:reset     # stop and delete the volumes — next dev:up seeds again
bun run dev:seed      # reseed by hand (refuses unless the database is empty)
```

## Onboarding data

A new machine gets its database from one of two places, in this order.

**1. `db/init/01-data.sql`, if it exists.** The Postgres image runs everything in
`/docker-entrypoint-initdb.d` the first time it initialises an empty volume, and
`db/init` is mounted there. The file is a `pg_dump` of a working development
database, so a new checkout comes up with the real shape of the data — and
because the dump carries the `_prisma_migrations` table, `migrate deploy`
afterwards finds nothing pending rather than colliding with tables that are
already there.

Produce it from a database that already looks the way you want a new machine to
look:

```bash
bun run pg:export --setup      # -> db/init/01-data.sql
bun run dev:reset && bun run dev:up   # verify it the way a new machine would
```

**2. The demo seed, otherwise.** `scripts/dev-bootstrap.mjs` runs on every app
start, and seeds only when it finds no business rows at all. That is the path
described under [First run](#first-run).

### The committed file is anonymised, and regenerating it is one command

`db/init/01-data.sql` is in git, because it only helps a new developer if it
arrives with the clone. It is not a copy of the development database: it is the
output of

```bash
bun run pg:anonymise      # -> db/init/01-data.sql
```

which takes a copy of development into a throwaway database, empties the tables
that are all identity and no structure (sessions, audit log, message bodies,
notifications), rewrites every customer name, phone number, address and mailbox,
sweeps free text for the same, resets every password, and then **reads back the
file it wrote** and fails if anything survived. The source database is never
touched.

What a new developer ends up with is the real shape of the data — 101 jobs, 95
clients, 103 invoices, payments totalling 58,846,362 — belonging to nobody:

```
admin1@eagle.test  admin2@eagle.test  admin3@eagle.test  ops1@eagle.test
ops2@eagle.test  technicianinternal1@eagle.test  technicianexternal1@eagle.test
salescorporate1@eagle.test   … password for all: password123
```

Regenerate it whenever the development database gains something worth having,
and commit the result. Everything else under `db/init/` is gitignored: a
hand-made dump dropped there is one nobody has checked.

**What it does not cover.** A colleague's first name that is also an ordinary
word — Mark, Grace, Hope — is left out of the free-text sweep, because sweeping
it would turn "marked as paid" into "[redacted]ed as paid". Those can survive
inside an expense description. Customer identities cannot; that is the line the
script enforces. The full reasoning is in the header of
`scripts/pg/anonymise.mjs`.

## Working with production data

The demo seed is what a new machine gets, and for almost all work it is enough.
Production data is a deliberate act, never automatic, because the dump carries
real clients, real phone numbers and real password hashes.

If you genuinely need it — reproducing a bug that only the real shape of the
data provokes — get the dump from someone who already has it, out of band, and:

Put the dump in the repo root (it is gitignored) and run the tooling **in the
container**, where `DATABASE_URL` already points at the development database —
the `pg:` scripts are the same tools run from the host, which needs that
variable set by hand:

```bash
bun run dev:import mrms-prod-2.db --check                            # validate, write nothing
bun run dev:import mrms-prod-2.db --truncate --resolve-duplicates --resolve-orphans
bun run dev:verify docs/pg-migration/baseline.mrms-prod-2.json       # counts
bun run dev:verify-business                                          # money, keys, enums, dates
```

`--check` reports the two known data problems and refuses to write until you
pass the flags that resolve them; both policies are argued out in
`docs/pg-migration/import-map.json`. The importer also derives columns the dump
predates, such as `Expense.paidAmount` — see `derivedColumns` in the same file.

Once it is on your machine it is your responsibility. `*.db` and `backups/` are
gitignored; keep it off tickets and out of chat.

To take a copy of whatever your development database currently holds:

```bash
bun run pg:export     # -> backups/mrms-dev-<timestamp>.dump, and tells you what is in it
```

It writes `pg_dump -Fc`, the same format the production `backup` service uses,
so it restores with `pg_restore` the same way.

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

## Adding a file to public/

`proxy.ts` used to allow static assets by listing them one filename at a time,
so a newly added image was redirected to `/login` with a 307 and `next/image`
reported *"The requested resource isn't a valid image"* — which reads like a
corrupt file rather than a routing rule. Assets are now allowed by extension, so
dropping a file into `public/` just works.

If you add a file whose URL collides with a route (`public/robots.txt` against
`app/robots.ts`, say), Next returns 500 with *"A conflicting public file and page
file was found"*. Keep one.

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
