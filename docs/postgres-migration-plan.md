# Postgres Migration + Docker Deployment Plan

Status: proposed (not started)
Author: analysis pass, 2026-08-24
Scope: move MRMS off SQLite/Turso onto PostgreSQL, export all current data into
it, and deploy the stack with Docker.

---

## 1. What the analysis found

### 1.1 The schema itself ports almost for free

`prisma/schema.prisma` (3,311 lines, 115 models, 59 enums) uses **no**
SQLite-specific or Postgres-unavailable constructs:

| Construct | Count | Postgres impact |
| --- | --- | --- |
| `Json` fields | 0 | none |
| `Decimal` fields | 0 | none |
| Scalar list fields (`String[]`) | 0 | none |
| `Bytes` / `BigInt` | 0 | none |
| `@db.*` native type attributes | 0 | none |
| `autoincrement()` | 0 | none — every PK is `cuid()` (114) |
| `@@map` table renames | 0 | table names == model names |
| `Float` fields | 98 | reclassified to `Decimal` per section 2.1 |
| `enum` blocks | 59 | become **native PG enum types** (was TEXT) |

So the datamodel needs a one-line provider change. The work is everywhere
*around* the schema.

### 1.2 The real cost: SQLite is wired into the runtime, not just the datasource

27 source files reference libsql / Turso / `file:` URLs, and there are **393 raw
SQL call sites**:

| File | Raw calls | What it does |
| --- | --- | --- |
| `app/api/admin/db-fix/route.ts` | 312 | Emergency prod DDL: `PRAGMA table_info`, `PRAGMA foreign_keys=OFF`, SQLite table rebuilds |
| `lib/prisma.ts` | 5 | libsql adapter + reactive `"no such column"` repair + `ensureMoneySchema()` DDL in SQLite types (`DATETIME`, `REAL`, `INTEGER` booleans) |
| `app/api/admin/db-health/route.ts` | 6 | `sqlite_master`, `PRAGMA table_info` |
| `lib/org-whatsapp-config.ts` | 8 | reads a table that is **not in the Prisma schema** |
| `lib/document-branding.ts` | 7 | `PRAGMA table_info` column guard |
| `lib/billing-events.ts` | 6 | reads a table **not in the schema** |
| `lib/platform-settings.ts` | 5 | reads a table **not in the schema** |
| `lib/commercial/org-number.ts` | 6 | document numbering |
| others (20 files) | ~38 | misc guards |

SQLite-only idioms in use: `sqlite_master` (7), `PRAGMA` (28), `"no such
column"` string matching (17), `"no such table"` (8).

`better-auth` is pinned to the wrong dialect at [lib/auth.ts:85](lib/auth.ts#L85):
`prismaAdapter(prisma, { provider: "sqlite" })`.

### 1.3 There is no migration history to preserve

Neither database has a `_prisma_migrations` table. Both were built with
`prisma db push` plus hand-written DDL healing. The 48 migration folders in
`prisma/migrations` contain SQLite-only DDL (`PRAGMA defer_foreign_keys` in 26
files, `PRAGMA foreign_keys` in 28) and **cannot be replayed on Postgres**.

Consequence: we are free to generate a single clean Postgres baseline migration.
Nothing is lost.

### 1.4 The production database has drifted from the schema — this is the main risk

Measured against `mrms-prod.db` (the local production snapshot):

- **51 columns** exist in `schema.prisma` but are **missing from the prod DB**
- **16 columns** exist in the prod DB but are **unknown to the schema**
- **8 tables** exist in the prod DB but are **unknown to the schema**
- **8 tables** exist in the schema but were never created in prod

Worst offenders (rows at risk):

| Table | Prod rows | Drift |
| --- | --- | --- |
| `Part` | 68 | missing 10 schema columns incl. `sellingPrice`, `taxRate`, all UoM fields |
| `PartStockTransaction` | 94 | missing 5, **including `orgId`** (tenant column!) |
| `Job` | 75 | missing `warrantyMonths`, `warrantyExpiresAt` |
| `OutboundMessage` | 221 | has `campaignContactId`, schema does not |
| `InvoiceLine` / `SaleItem` | 6 / 12 | missing `saleUomFactor`, `costAtSale` |
| `Quotation` | 6 | missing `issueDate` |
| `RepairRequest` | 16 | missing `clientId`, `submittedByPortalUserId` |
| `DocumentBrandingSettings` | 2 | missing `vatInclusive`, `paymentInstructions`, `paymentAccounts` |
| `OrgUsageSnapshot`, `OrgSubscriptionEvent`, `OrgFeatureEntitlement` | 0 | entirely different column shapes (legacy vs current) |

**Six tables are managed only by raw SQL and are absent from the schema**
(they will silently vanish in a schema-driven migration):

| Table | Prod rows | Read by |
| --- | --- | --- |
| `BranchNumberingSettings` | 1 | `lib/commercial/org-number.ts` |
| `OrgWhatsAppConfig` | 0 | `lib/org-whatsapp-config.ts` |
| `PlatformSetting` | 0 | `lib/platform-settings.ts` |
| `BillingEvent` | 0 | `lib/billing-events.ts` |
| `OrgSecurityPolicy` | 0 | settings |
| `BranchOperatingHours` | 0 | branches |

Two tables are junk from past emergency repairs and should be dropped, not
migrated: `Organisation` (1 row — a UK-spelling duplicate of `Organization`
created by an old DDL typo) and `Job_restore_backup_20260426` (1 row). No code
references either.

### 1.5 Data volume is small — a row-by-row copy is entirely viable

| Source | Rows | Size |
| --- | --- | --- |
| `mrms-prod.db` (prod snapshot, stale: newest row 2026-07-10) | **2,780** | 4.1 MB |
| `prisma/dev.db` (local dev) | ~370 | 3.1 MB |

Biggest tables: `AuditLog` 844, `Notification` 690, `OutboundMessage` 221,
`Session` 195, `PartStockTransaction` 94, `Client` 77, `Job` 75.

At this size we do **not** need `pgloader` or logical replication. A scripted
Prisma-to-Prisma copy in FK-safe order is simpler, type-safe, and reviewable.

Storage formats confirmed: `DateTime` is stored as **ISO-8601 text**
(`2026-06-01T13:14:40.624+00:00`), `Boolean` as **integer 0/1**. Both need
explicit coercion on import. `PRAGMA foreign_key_check` is clean — no orphan
rows.

### 1.6 Deployment today, and what Docker has to replace

- **Vercel** is the live target. `vercel.json` defines **4 cron jobs**
  (`whatsapp-retry`, `subscription-lifecycle`, `data-heal`, `audit-prune`).
  Vercel Cron does not exist in Docker — these need a replacement scheduler.
- `render.yaml` exists as an alternative: SQLite on a 5 GB disk with
  `ALLOW_SQLITE_PRODUCTION=1`. Obsolete after this migration.
- `Dockerfile` / `docker-compose.yml` exist but are **SQLite-shaped**: compose
  sets `DATABASE_URL: file:./prisma/dev.db` and bind-mounts `./prisma` into the
  container. No database service, no Redis, no migration step, no healthcheck,
  runs as root.
- `scripts/vercel-build.mjs` performs elaborate gymnastics that exist *only*
  because the Prisma provider is `sqlite`: it force-sets
  `DATABASE_URL=file:./dev.db` for build validation, clears Turso env, then runs
  two "schema healing" scripts against prod. **All of this deletes itself once
  the provider is Postgres.** Same for the `file:`-URL juggling in
  `prisma.config.ts`.
- Optional infra already coded and ready to use: `REDIS_URL` drives BullMQ
  (`lib/queue/`) and the permission cache (`lib/permission-cache.ts`), both with
  inline fallbacks. `UPLOADS_DIR` drives local file storage (`lib/storage.ts`);
  no upload files exist on disk locally today.

### 1.7 Known blockers to clear along the way

- `lib/queue/index.ts` + `worker.ts` have a pre-existing type error
  (bullmq ↔ ioredis: `Type 'Redis' is not assignable to type
  'ConnectionOptions'`). Must be fixed before a worker container can build.
- The prod snapshot is **stale** (Jul 14; newest row Jul 10). A fresh dump is
  required at cutover.
- The `turso` CLI is not installed locally. `@libsql/client` is already a
  dependency, so the dump script can use it directly instead.
- Locally available: `docker`, `psql`, `pg_dump`, `sqlite3`.

---

## 2. Decisions (settled 2026-08-24)

| Question | Decision |
| --- | --- |
| Where does Docker run in production? | **Single VPS with `docker compose`** |
| Managed Postgres or containerised? | **Containerised** — so the `pg_dump` sidecar and a rehearsed restore are mandatory deliverables, not nice-to-haves (Phase 5.6) |
| Money columns | **Convert to `Decimal`** |
| Fresh production dump | Owner supplies the latest export at cutover; the tooling takes a SQLite file path as input |

### 2.1 What "convert to Decimal" costs, and the boundary chosen

SQLite has a single numeric type, so the schema could not distinguish money from
a GPS coordinate. Postgres can. `scripts/pg/classify-numeric.mjs` classifies all
**98** `Float` fields and writes the result to
`docs/pg-migration/numeric-classification.json` for review:

| Class | Count | Target |
| --- | --- | --- |
| money | 75 | `Decimal @db.Decimal(18, 2)` |
| rate (exchange rates, tax rates, VAT percent) | 8 | `Decimal @db.Decimal(12, 6)` |
| factor (unit-of-measure conversion) | 5 | `Decimal @db.Decimal(18, 6)` |
| quantity (stock, fractional in this schema) | 4 | `Decimal @db.Decimal(18, 3)` |
| measure (GPS, generic metric buckets, plan limits) | 6 | stays `Float` |

**The honest cost.** Prisma returns `Decimal` columns as `Prisma.Decimal`
objects, not numbers. Measured blast radius in this codebase:

- **197 files** and **3,154 reference lines** touch money field names
- **185** Prisma `aggregate` / `_sum` call sites
- **689** formatting sites; `formatMoney(amount: number)` in `lib/currency.ts` is
  the single central formatter
- **66** `toFixed()` calls

The dangerous part is not the volume, it is the failure mode: in JavaScript
`decimalA + decimalB` **concatenates strings** instead of erroring. A missed site
produces a plausible-looking wrong total with no exception and no test failure.
Converting 197 files by hand in one pass is how silent financial corruption gets
shipped.

**Boundary chosen:** exact `numeric` **in the database**, plain `number` **at the
application boundary**. A single Prisma query extension (~20 lines) walks each
result and converts any `Prisma.Decimal` to a number, so all 197 files keep
working unchanged and no call site can ever see a Decimal.

What this buys:

- Storage is exact — no float representation drift at rest, ever
- SQL-side `SUM`/`AVG` are computed in exact arithmetic by Postgres
- The 185 aggregate sites are covered by the same extension
- Zero silent-string-concatenation risk, because the app never holds a Decimal

What it does not buy: arithmetic performed *in JavaScript* is still float. For
UGX — a zero-decimal currency whose amounts are whole shillings well inside
float64's exact integer range — that is precise today; the exposure is limited to
computed fractions (VAT, percentage discounts) which are rounded for display
anyway.

The door stays open: Phase 7.1 can lift individual finance write paths (payment
posting, invoice totals, journal lines) to end-to-end Decimal arithmetic, one
path at a time with tests, rather than as a 197-file flag day. **If you would
rather have end-to-end Decimal arithmetic from the start, say so and Phase 2
grows a dedicated sub-phase for it** — it is a materially larger and riskier
piece of work, which is why it is not the default here.

## 3. Phased plan

Each phase ends in a committable, independently verifiable state. Phases 0–1 are
pure de-risking and touch **no** Postgres code — they are worth doing even if the
migration is postponed.

### Phase 0 — Baseline and instrumentation (no behaviour change) — **DONE**

| # | Task | Status |
| --- | --- | --- |
| 0.1 | `scripts/pg/schema-model.mjs` — a small standalone schema parser (models, scalar columns, `@map`/`@@map`, enums). Deliberately not a Prisma internal: the tooling must keep working while the provider changes underneath it | done |
| 0.2 | `scripts/pg/drift-report.mjs` — table/column drift against any SQLite DB, `--json` and `--strict` modes. Reproduces 51 missing / 16 unknown / 6 unknown tables / 8 missing tables on the prod snapshot | done |
| 0.3 | `scripts/pg/baseline.mjs` — verification fingerprint: row counts, **sum of every numeric column**, and min/max of every timestamp column. Captured for both databases | done |
| 0.4 | `scripts/pg/classify-numeric.mjs` — the 98-field numeric classification behind the Decimal decision (section 2.1) | done |
| 0.5 | `scripts/pg/junk-tables.mjs` — the shared exclusion list (`Organisation`, `Job_restore_backup_20260426`, `_prisma_migrations`) used by both the baseline and the import | done |
| 0.6 | `docker-compose.dev.yml` — `postgres:18-alpine` on **port 5433** plus a scratch instance on 5434 for import rehearsals. 5433 because a host Postgres commonly holds 5432 and the collision is silent | done |
| 0.7 | `bun run pg:up / pg:down / pg:reset / pg:drift / pg:baseline` | done |
| — | A fresh production dump script was **dropped**: the owner supplies the latest export at cutover, and every tool takes a SQLite file path as input | n/a |

Captured artefacts, committed for later comparison:

- `docs/pg-migration/baseline.mrms-prod.json` — 113 tables, **2,778 rows**, 47 non-empty
- `docs/pg-migration/baseline.dev.json` — 112 tables, 369 rows, 26 non-empty
- `docs/pg-migration/numeric-classification.json` — 98 fields, 92 to `Decimal`
- `docs/pg-migration/local-postgres.md` — connection strings and usage

Sample control totals the import must reproduce exactly (from the prod snapshot):

| Measure | Value |
| --- | --- |
| `SUM(Payment.amount)` | 20,348,100 |
| `SUM(Invoice.totalAmount)` / `paidAmount` | 18,160,000 / 16,630,000 |
| `SUM(Sale.totalAmount)` | 4,814,400 |
| `SUM(Job.finalCost)` (`clientBill`) | 20,910,000 |
| `Payment.createdAt` range | 2026-06-01 → 2026-07-09 |

**Notable finding from running the tooling:** all 51 schema-only columns are
nullable or defaulted — the drift report finds **zero** required-without-default
columns over existing rows. The `PartStockTransaction.orgId` concern raised in
the first analysis pass was wrong; the field is `String?`. That removes the
highest-severity item from the risk register.

### Phase 1 — Make `schema.prisma` the single source of truth — **DONE**

| # | Task | Result |
| --- | --- | --- |
| 1.1 | Promote the raw-SQL-only tables to models | 3 promoted: `PlatformSetting`, `OrgWhatsAppConfig`, `BillingEvent`. Column shapes copied from the live tables so the import is a straight copy. Intentionally no Prisma relation to `Organization` — the production tables carry no FK and inventing one would also invent cascade semantics for billing history |
| 1.2 | Retire the tables that turned out to be dead | 3 retired: `BranchNumberingSettings`, `BranchOperatingHours`, `OrgSecurityPolicy`. All three have **zero** references anywhere in `app/`, `lib/`, `components/` or `scripts/` — not even in `db-fix`, which created them. Contents preserved in `docs/pg-migration/retired-tables.md` |
| 1.3 | Resolve the 16 unknown columns | All 16 dropped, recorded with per-column reasoning in `docs/pg-migration/import-map.json`. Every one is either zero-row or 100% NULL with no code references — including `OutboundMessage.campaignContactId`, which spans 221 rows but is **entirely null** |
| 1.4 | Confirm the 51 schema-only columns are safe to default | Confirmed: the drift report finds zero required-without-default columns over existing rows |
| 1.5 | Convert the raw-SQL reads to Prisma | 4 modules, **26 raw call sites removed** (393 → 367). `lib/platform-settings.ts` 70→62, `lib/billing-events.ts` 137→158, `lib/org-whatsapp-config.ts` 137→128, `lib/document-branding.ts` **293→180** |
| 1.6 | Gate | `prisma validate` OK, `tsc` 0 errors, `lint` 0 errors, **508 unit tests pass / 0 fail**, plus 27 hand-written functional assertions against a real database |

Drift is now: **0 unknown tables, 0 unknown columns.** The 51 schema-only columns
remain by design — migrations create them in Postgres.

Three defects were fixed incidentally, because moving to Prisma made them
visible:

1. **`recordBillingEvent` was not idempotent.** It ran a bare `INSERT` while
   documenting an `idempotencyKey` parameter, so a redelivered Pesapal webhook
   would either duplicate a payment record or throw on the primary key. Now an
   `upsert`, verified by asserting that a repeated delivery leaves one row.
2. **`getMonthlyRevenue` used `date('now', 'start of month')`** — SQLite-only
   syntax that would have thrown on Postgres. The boundary is now computed in JS.
3. **`getPlatformSettings` ran one query per key** in a loop. Now a single
   `IN` query.

Two hidden couplings surfaced that Phase 2 removes:

- `prisma.config.ts` silently overrides `DATABASE_URL`. Pushing to an explicit
  scratch path wrote to `prisma/dev.db` instead, and `bun run test:unit`
  advertises `prisma/test.db` while actually using `dev.db`.
- `createMany({ skipDuplicates })` is unsupported on SQLite, so the seeding path
  had to use `upsert`. On Postgres either would work.

### Phase 2 — Provider cutover — **DONE**

| # | Task | Result |
| --- | --- | --- |
| 2.1 | `provider = "postgresql"`, `url = env("DATABASE_URL")` | `prisma validate` OK |
| 2.2 | Archive the 48 SQLite migrations, generate a Postgres baseline | `prisma/migrations-sqlite-archive/` + `prisma/migrations/0_init` — **119 tables, 59 native enum types, 308 indexes, 203 foreign keys, 93 numeric columns**. Applied to the container; `_prisma_migrations` now exists for the first time in this project's history |
| 2.3 | Rewrite `lib/prisma.ts` | **382 → 175 lines.** Gone: the libsql adapter, `file:` URL normalisation, the hand-listed 19-model stale-client check (now derived from `Prisma.dmmf`), the four reactive `"no such column"` → `ALTER TABLE` extensions, and `ensureMoneySchema()` — plus its **16 call sites** across 9 files |
| 2.4 | `prismaAdapter(prisma, { provider: "postgresql" })` | Login verified |
| 2.5 | Simplify `prisma.config.ts` | 57 → 24 lines of intent + a small env loader. The old version silently rewrote `DATABASE_URL` to `prisma/dev.db`, which is why `bun run test:unit` had been running against the development database |
| 2.6 | Replace `scripts/vercel-build.mjs` with `scripts/build.mjs` | 101 → 45 lines. The build no longer needs a database at all |
| 2.7 | Purge Turso/SQLite coupling | `@libsql/client` moved to devDependencies (the migration tooling reads the dump with it), `@prisma/adapter-libsql` removed, ~20 npm scripts de-prefixed, `render.yaml` deleted (SQLite-on-a-disk), 11 stale code comments corrected, and 4 schema-healing scripts deleted: `sync-schema-to-db.mjs`, `prod-job-column-safety.mjs`, `schema-drift-check.mjs`, `reconcile-empty-schema.mjs` |
| 2.8 | Apply the numeric classification | 93 fields → `Decimal` with explicit precision; 6 stay `Float`. The apply script refuses to run if the schema and the classification file disagree — which is how it caught `BillingEvent.amount`, added in Phase 1 after the classification was generated |
| 2.9 | The Decimal boundary | See below — this was the substantial piece |
| 2.10 | Gate | `tsc` **0 errors**, `lint` 0 errors, **508 unit tests pass / 0 fail**, production build succeeds, 13 hand-written Decimal assertions pass |

#### What the Decimal work actually took

The plan predicted the danger was silent string concatenation. **That prediction was
wrong**, and in a useful direction: with generated Decimal types, TypeScript
flags every arithmetic site. Turning on `Decimal` produced **781 compile errors
across 131 files** — nothing silent about it.

That made a better solution available than the one originally planned. Prisma's
`result` extension can override a scalar field's *declared type* as well as its
value (verified by probe before committing to it), so one generated file maps all
93 Decimal columns to `number` at the boundary. Types and runtime then agree,
and no call site can receive a `Decimal`.

Progress in three steps, each measured:

| Step | Errors | Files |
| --- | --- | --- |
| `Decimal` applied, no boundary | 781 | 131 |
| + generated `result` extension (`lib/prisma-decimal.ts`, 93 fields / 41 models) | 196 | 11 |
| + `Db` / `TxClient` / `Row` types replacing `PrismaClient` / `Prisma.TransactionClient` / `Prisma.*GetPayload` | **0** | 0 |

The third step is the part worth remembering: 64 of the remaining 196 errors came
from just **6** declaration sites typed `Prisma.TransactionClient`, which an
extended client is not assignable to. `Prisma.JobGetPayload<...>` had the same
blind spot — generated payload types ignore extensions and still described money
as `Decimal`. `lib/prisma.ts` now exports `Db`, `TxClient` and `Row<Delegate, Args>`
for exactly this.

Two layers are needed, because they cover different ground:

- the **`result` extension** fixes model reads, and is what makes the *types*
  right;
- a **`query` extension** catches what field mapping cannot see — `aggregate`,
  `groupBy` and `$queryRaw` all return Decimals that belong to no model field.

What this buys, demonstrated in the verification: ten payments of `0.10` sum to
exactly `1` in Postgres, where naive JS accumulation gives
`0.9999999999999999`. Storage is `numeric(18,2)`; an unextended client still
returns `Decimal`, which proves the extension is what converts.

#### A real gap the migration exposed

`tests/unit/helpers.ts` constructed a bare `new PrismaClient()`, so the whole
suite exercised a **different client than production** — no extensions, no
`orgDb` behaviour. With money as `numeric` that surfaced as a test comparing two
distinct `Decimal` instances and failing with `Expected: 38, Received: 38`. The
helpers now hand tests the application's client, so the suite covers the
boundary it is supposed to protect.

### Phase 3 — Replace SQLite introspection and retire the healing machinery

| # | Task | Verify |
| --- | --- | --- |
| 3.1 | `app/api/admin/db-health/route.ts`: `sqlite_master` / `PRAGMA table_info` → `information_schema.tables` / `information_schema.columns` | Health page renders |
| 3.2 | `lib/platform-health.ts`, `lib/payouts.ts`, `app/api/admin/probe/route.ts`: same substitution | Pages render |
| 3.3 | `app/api/admin/db-fix/route.ts` (2,602 lines, 312 raw calls): reduce to a read-only reporter over `prisma migrate status` + `information_schema`. Its entire purpose — patching drift at runtime — is now handled by migrations. Do this in two steps: make it a no-op behind a flag, then delete the DDL bodies | Route returns a report; no DDL is executed |
| 3.4 | Delete or port the SQLite-only scripts: `sync-schema-to-db.mjs`, `prod-job-column-safety.mjs`, `reconcile-empty-schema.mjs`, `schema-drift-check.mjs` | `bun run predeploy:check` passes |
| 3.5 | Fix the pre-existing `lib/queue` bullmq/ioredis type error (needed for the worker container) | `tsc` clean, worker starts |

Exit: no SQLite idiom remains in application code.

### Phase 4 — The data export/import tool

Written and rehearsed **before** it is pointed at production.

| # | Task | Verify |
| --- | --- | --- |
| 4.1 | `scripts/pg/export-sqlite.mjs`: every table → newline-delimited JSON, with coercion (integer 0/1 → boolean, ISO text → `Date`, `REAL` → number), excluding the junk tables | One `.ndjson` per table; counts match `baseline.json` |
| 4.2 | `scripts/pg/validate-enums.mjs`: for all 59 enums, assert every distinct value present in the dump is a valid schema label; fail loudly with the offending rows. (Spot-checked already: `Job.status` is clean) | Zero invalid labels, or an explicit remap list |
| 4.3 | `scripts/pg/import-postgres.mjs`: insert in FK-safe topological order, batched `createMany`, one transaction per table, applying the Phase 1.3 defaults for the 51 new columns and dropping the resolved unknown columns | Import completes on empty PG |
| 4.4 | `scripts/pg/verify-import.mjs`: per-table row-count equality, money control totals, FK spot-joins (`Job→Client`, `Payment→Invoice`, `SaleItem→Sale`), and a sample of round-tripped timestamps | All equal to `baseline.json` |
| 4.5 | Dry run A: `prisma/dev.db` → local PG (small, safe) | Verified |
| 4.6 | Dry run B: fresh Turso dump → local PG, twice (idempotency check) | Verified, repeatable |
| 4.7 | Manual UI pass on the imported data: jobs list, a job detail, invoices, payments, dashboard KPIs, outbox | Numbers match the live app |

Exit: a repeatable, verified import. Rehearsed at least twice end to end.

### Phase 5 — Docker deployment

| # | Task | Verify |
| --- | --- | --- |
| 5.1 | Rewrite `Dockerfile`: bun deps stage → build stage (`prisma generate` + `next build`, `output: "standalone"`) → slim runner. Copy Prisma engines + `prisma/`, run as a **non-root** user, add `HEALTHCHECK` against `/api/health` | Image builds; container serves |
| 5.2 | Rewrite `docker-compose.yml`: `postgres:16-alpine` (named volume, healthcheck, `POSTGRES_*` from `.env`), `app` with `depends_on: condition: service_healthy`, named volume for `UPLOADS_DIR` | `docker compose up` serves a working app |
| 5.3 | Migration on deploy: a one-shot `migrate` service (or entrypoint step) running `prisma migrate deploy` before `app` starts, guarded by a PG advisory lock so concurrent replicas cannot race | Fresh `up` on an empty volume creates the schema once |
| 5.4 | Add `redis:7-alpine` + a `worker` service (`bun lib/queue/worker.ts`) with `REDIS_URL` set | Worker connects; jobs process |
| 5.5 | **Replace the 4 Vercel crons** — they do not run under Docker. Either a small scheduler container hitting the routes with `CRON_SECRET`, or `node-cron` inside the worker | All 4 routes fire on schedule; verified via `OutboundMessage` retries |
| 5.6 | `pg_dump` backup sidecar writing to a mounted volume on a schedule, plus a documented restore drill | A restore into a scratch DB succeeds |
| 5.7 | Update `.dockerignore` (currently ignores `prisma/dev.db` — now irrelevant); add `docker-compose.prod.yml` with pinned image tags and no bind mounts | Prod compose starts clean |
| 5.8 | Update `AGENTS.md`: the Prisma/Turso runbook sections, the build-script explanation, and the "Common production DB errors" table all describe SQLite behaviour that no longer exists | Docs match reality |

Exit: `docker compose up` gives Postgres + app + worker + redis + scheduler with
migrations applied automatically.

### Phase 6 — Production cutover

| # | Task |
| --- | --- |
| 6.1 | Provision production Postgres; store credentials; confirm TLS and backups |
| 6.2 | Announce a maintenance window; enable a write freeze |
| 6.3 | Fresh Turso dump (Phase 0.2) — this is the authoritative snapshot |
| 6.4 | `prisma migrate deploy` → import (Phase 4.3) → verify (Phase 4.4). Abort on any mismatch |
| 6.5 | Deploy the Docker stack pointed at PG; run `bun run smoke:prod` and `bun run predeploy:check` |
| 6.6 | Manual smoke: login, create a job, record a payment, send a WhatsApp message, generate an invoice PDF |
| 6.7 | Lift the freeze. Keep Turso **read-only** for at least 7 days as the rollback path; keep the dump archived |
| 6.8 | Decommission Turso; delete `mrms-prod.db` and the SQLite archive once confidence holds |

### Phase 7 — Postgres-native follow-ups (optional, after stability)

| # | Task | Why |
| --- | --- | --- |
| 7.1 | `Float` → `Decimal(18, 2)` for the 101 money columns | Removes float rounding from finance totals |
| 7.2 | Adopt `mode: "insensitive"` in client/job/part search (0 uses today — it is unsupported on SQLite) | Better search, no `LOWER()` workarounds |
| 7.3 | Review indexes for real query plans; `CREATE INDEX CONCURRENTLY` | SQLite index choices were never plan-verified |
| 7.4 | Connection pooling (pgbouncer) if concurrency grows | Prisma opens a pool per instance |
| 7.5 | Replace the remaining raw-SQL guard clauses now that drift cannot recur | Simplification |

---

## 4. Risk register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Prod columns missing from the schema cause silent data loss on import | **High** | Phase 1.2 resolves all 16 explicitly; the import manifest is column-exact and fails on unmapped columns |
| The 6 raw-SQL tables are forgotten and dropped | **High** | Phase 1.1 promotes them to real models before anything moves |
| ~~`PartStockTransaction.orgId` NOT NULL over 94 rows~~ — **retired**: measured, the field is `String?`. `scripts/pg/drift-report.mjs` reports **zero** required-without-default columns over existing rows across all 51 | Low | Drift report re-checks this on every run and warns loudly if a future schema change introduces one |
| Decimal conversion silently concatenates strings at a missed arithmetic site | **High** | Avoided by construction: the query extension means no call site ever receives a `Decimal` (section 2.1) |
| Decimal precision chosen wrongly for a field (e.g. a rate truncated to 2dp) | Medium | Classification is committed as reviewable data, not inferred at edit time; baseline control totals in Phase 4.4 compare exact sums before and after |
| Enum labels in data that PG's native enums reject | Medium | Phase 4.2 validates all 59 enums before import; `Job.status` already spot-checked clean |
| Timestamp/boolean coercion errors (ISO text, integer 0/1) | Medium | Phase 4.1 coerces explicitly; Phase 4.4 round-trip-verifies samples |
| Vercel crons silently stop under Docker | Medium | Phase 5.5 is a named deliverable, not an afterthought |
| Losing SQLite's trivial file-copy backups | Medium | Phase 5.6 `pg_dump` sidecar plus a rehearsed restore |
| Stale snapshot used at cutover | Medium | Phase 6.3 re-dumps inside the freeze window |
| `db-fix` removal leaves no emergency lever | Low | Migrations replace it; Phase 3.3 keeps a read-only reporter |

## 5. Sequencing note

Phases 0 and 1 are safe on `main` today and carry standalone value: they make
the schema honest and delete ~30 raw SQL sites regardless of what database sits
underneath. Phases 2–4 belong on a single feature branch. Phase 5 can proceed in
parallel with Phase 4, since Docker work does not depend on the import tool.
