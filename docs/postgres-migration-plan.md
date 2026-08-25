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

### Phase 3 — Retire the SQLite introspection and the healing machinery — **DONE**

| # | Task | Result |
| --- | --- | --- |
| 3.1 | `lib/db-introspect.ts` — one place for schema introspection, on `information_schema` | `listTables`, `tableExists`, `tableColumns`, `columnNames`, `columnExists`, `appliedMigrations` |
| 3.2 | `app/api/admin/db-health` rewritten | **218 → 141 lines.** It no longer checks a hardcoded list of tables and columns that had to be edited as the schema grew. It diffs the **entire datamodel** (via `Prisma.dmmf`) against the live schema, and reports migration state — the mechanism that now keeps them in step |
| 3.3 | `app/api/admin/db-fix` retired | **2,602 → 63 lines.** Read-only; `POST` returns 410 Gone. Kept reachable because admin screens link to it, and whoever follows that link deserves an explanation rather than a 404 |
| 3.4 | `lib/platform-health.ts`, `lib/payouts.ts`, `app/api/admin/probe` ported | `payouts.hasJobPayoutColumns()` no longer probes `PRAGMA table_info("Job")` — those columns are in the baseline, so a database without them is a failed deployment to surface, not a condition for feature code to tiptoe around |
| 3.5 | `app/api/admin/runtime-db` rewritten | Reports host/database/user/sslmode/pool from the parsed connection string (never the password) plus the live server version, instead of Turso-vs-SQLite mode |
| 3.6 | Four UI references to "DB Fix" repointed to DB Health | `/pos`, `/platform/orgs/[id]`, `/platform/audit`, and a stale comment in `/settings/users` |
| 3.7 | The bullmq/ioredis type error | Already resolved by the dependency reinstall; `lib/queue` is in scope and typechecks |
| — | Gate | `tsc` 0 errors, `lint` 0 errors, 508 unit tests pass, 14 introspection/error assertions pass |

**Raw SQL call sites: 393 → 47.** Every remaining mention of `sqlite_master`,
`PRAGMA` or `date('now')` in the repo is inside a comment explaining what used to
be there.

#### A migration bug this phase caught before it shipped

Seven call sites degraded gracefully when a relation was missing — the POS screen
shows a setup banner, the WhatsApp outbox falls back to sending without logging —
and each detected that condition by matching the string `"no such table"`. That
is SQLite's wording. Postgres says `relation "Sale" does not exist`.

Every one of those checks would have silently stopped matching, turning a handled
condition into an unhandled exception in front of a user. `lib/db-errors.ts` now
keys off Prisma's error codes (`P2021`, `P2022`) with both dialects' wording as
fallback, and is verified against errors raised by the real database.

### Phase 4 — The data export/import tool — **DONE**

Built as one schema-aware importer rather than the planned export/import pair. A
generic table-to-table copier can only match columns by name and hope; this one
reads the datamodel, so it knows which columns exist, which are enums, which are
dates, and — from the foreign-key graph — what order the tables must be written
in now that Postgres actually enforces those keys.

| # | Task | Result |
| --- | --- | --- |
| 4.1 | `scripts/pg/import.mjs` | Topological table order derived from the FK graph (119 tables, no cycles); the one self-reference, `ChartOfAccount.parentId`, is written null and filled in a second pass |
| 4.2 | Pre-flight validation, six checks | Enum labels, dropped-column emptiness, orphan foreign keys, unknown tables, unknown columns, **and unique-constraint violations** |
| 4.3 | `scripts/pg/coerce.mjs` | Shared date/boolean coercion — see below |
| 4.4 | `scripts/pg/verify-import.mjs` | Row counts, the sum of every numeric column, and the min/max of every timestamp, against the baseline; intended differences declared in `import-map.json` rather than waved through |
| 4.5 | `scripts/pg/verify-business.ts` | 17 assertions that the result is *usable*: relationships resolve, enums are valid native labels, money reads as numbers, resolutions did what they claimed |
| 4.6 | Rehearsals | Production snapshot **and** dev database, each imported and verified; production imported twice to confirm idempotency; a re-run without `--truncate` is refused so a mistyped URL cannot silently merge two datasets |

Result on the production snapshot: **2,777 rows across 46 tables**, and
`row counts, numeric sums and timestamp ranges all match`.

#### Two real data problems, found before the cutover

**`Job.invoiceNumber` had 13 duplicated values over 15 surplus rows.** The
datamodel declares it `@unique`; production has no such index, so the duplicates
were never rejected. The job numbers involved span different months
(`EIS-4/2026/0020`, `EIS-5/2026/0020`, `EI-2026-0020`), which points at a
document-numbering sequence collision rather than genuine duplicate invoicing.

This surfaced the hard way and is worth recording: the first import run used
`createMany({ skipDuplicates: true })`, which **silently dropped 15 Job rows**,
and the import then failed on `Invoice_jobId_fkey` because invoices referenced
jobs that had quietly vanished. `skipDuplicates` is gone — a row that cannot be
written is a finding, not something to drop, and dropping a parent cascades.

The resolution is not "keep the first row". `Invoice` is authoritative and its
own numbers are unique; for each duplicated number there is exactly one Invoice
row referencing exactly one Job. The value is kept on **that** job and cleared on
the others — verified afterwards by asserting that no kept number sits on a job
its Invoice does not reference. Nothing in `Invoice`, `Payment` or `Receipt` is
touched. Resolutions require `--resolve-duplicates`, are declared in
`import-map.json` with their reasoning, and every single change is printed.

**`DocumentBrandingSettings` had two rows claiming the same `orgId`** — the legacy
`id='singleton'` row and the per-org row. The per-org row keeps the `orgId`; the
singleton's is cleared, which leaves it readable by id as the fallback
`lib/document-branding.ts` still looks for.

#### The dates were the hard part

Three separate bugs, all from the same root: **these databases do not agree on
how to store a timestamp.** The production snapshot holds ISO-8601 text,
`prisma/dev.db` holds integer epoch milliseconds, and rows written by the old
hand-written DDL hold `"YYYY-MM-DD HH:MM:SS"` from SQLite's `CURRENT_TIMESTAMP`.
All three appear in the same column in places.

1. **A three-hour shift.** `CURRENT_TIMESTAMP` is UTC, but `new Date("2026-05-25 11:10:00")`
   reads a space-separated string as *local* time — on this machine (EAT, UTC+3)
   every such row would have moved three hours. Confirmed against the dump:
   SQLite's `datetime('now')` returned 20:22 while local was 23:22.
2. **Truncated milliseconds.** Reported as data loss; it was the verifier
   stringifying a `Date` before parsing it, and `String(date)` has no
   milliseconds. The stored value was exact all along.
3. **An inverted min/max.** SQLite orders INTEGER before TEXT *regardless of
   value*, so `MIN`/`MAX` on a mixed-format column returns the first integer and
   the last string — not the earliest and latest instant. The baseline now reads
   the values and compares them as instants.

Each bug lived in a different script's private copy of the parsing, which is why
`scripts/pg/coerce.mjs` now exists and all three use it.

### Phase 5 — Docker deployment — **DONE**

Everything containerised, database included, on one VPS. Full runbook in
`docs/deployment.md`.

| # | Task | Result |
| --- | --- | --- |
| 5.1 | `Dockerfile` | Seven stages, five runtime images: `runner` (618MB), `migrator`, `worker`, `scheduler` (346MB), `backup`. Debian-based on purpose — Prisma's default engine is `debian-openssl-3.0.x` and an Alpine runtime needs a musl target declared in `binaryTargets`, a footgun with no payoff here |
| 5.2 | `docker-compose.yml` | postgres, migrate, app, redis, worker, scheduler, backup. Postgres is `expose`d, never published — an open Postgres port on a VPS is scanned within hours |
| 5.3 | Migrations on release | A one-shot `migrate` service; `app` depends on `service_completed_successfully`, so a failed migration leaves the previous container serving instead of starting a new one against a schema it does not match. Prisma's own advisory lock serialises concurrent replicas |
| 5.4 | Redis + worker | `redis:7-alpine` with append-only persistence so a restart does not lose queued jobs |
| 5.5 | **Replacing Vercel Cron** | `scripts/scheduler.mjs` — the same four jobs, same schedules, calling each route with `Authorization: Bearer $CRON_SECRET`. Its cron matcher is unit-tested against all four expressions, and all four routes were confirmed returning 200 with the secret and 403 without |
| 5.6 | Backups + restore drill | `pg_dump -Fc` on a schedule; written to a `.partial` name and moved on success, so an interrupted dump cannot be mistaken for a usable one. **Drill run:** dump → restore into a scratch database → 75 jobs and 20,348,100.00 in payments in both |
| 5.7 | `.dockerignore`, `.env.docker.example` | Compose fails fast on missing required values rather than starting half-configured. `docs/pg-migration` is deliberately *not* ignored — `import-map.json` is operational input the migrator image runs |
| 5.8 | `AGENTS.md` rewritten | Its Prisma/Turso runbook, error table, build instructions and troubleshooting steps all described a database that no longer exists |
| — | `vercel.json` and `render.yaml` deleted | The former held only the crons the scheduler now owns; the latter deployed SQLite on a mounted disk |

#### Verified by running it, not by reading it

- All five images build; the full stack comes up with `app` reporting **healthy**
- Migrations applied by the one-shot service: **120 tables, 59 enums**
- The app runs as **uid 1000 (non-root)**; `/` and `/login` return 200
- The production snapshot imported **into the containerised database** (2,777
  rows) via `docker compose run` with the dump mounted read-only, then verified
  with both the fingerprint comparison and the 17 business assertions — inside
  the stack
- Backup taken, restored into a scratch database, counts and money totals
  identical

#### Two problems this phase found

**`next.config.ts` had no `output: "standalone"`,** while the existing Dockerfile
copied `.next/standalone` — a directory `next build` was never producing. The
image could not have worked.

**`/api/health` was session-gated,** so it redirected to `/login` (307). The
container healthcheck was therefore meaningless: `curl -fsS` saw a redirect and
passed, proving only that the server answered. It is now in `PUBLIC_PATHS`, and
the healthcheck was tested for real — stopping `postgres` gives HTTP 503
immediately, Docker marks the container `unhealthy` after its retries (~75s), and
restarting `postgres` returns it to `healthy` within 30s.

Also fixed: `docker-compose.dev.yml` had no compose project name, so it defaulted
to the directory name and shared a project with the application stack — `docker
compose ps` on production listed the development database as part of it. It now
declares `name: mrms-dev`.

### Phase 6 — Production cutover — **PREPARED, blocked on a fresh dump**

Every step is rehearsed and written up in `docs/cutover-runbook.md`. Two steps
need the live systems and cannot be done from here:

- **taking the final dump** inside the write freeze — `scripts/pg/dump-turso.mjs`
  is written and rehearsed against a local source (2,780 rows, 115 tables, row
  counts matched, and the resulting fingerprint is byte-identical per table to
  the original), but it has never run against live Turso credentials;
- **switching traffic** to the new stack.

The snapshot in the repo is from 2026-07-14 with its newest row on 2026-07-10, so
it is too old to cut over from. Rehearsed duration for the data steps: under two
minutes.

The runbook is deliberately ordered so that everything reversible happens first:
the stack is proven healthy while empty, the import is validated before it writes,
and verification happens **before** traffic moves. Up to that point rollback is
"stop the new stack".

One thing to watch at step 8: `--check` will report the same two duplicate-key
findings as the rehearsal, plus anything created since July. **A new finding means
stop** — the resolvers cover only what was analysed.

### Phase 7 — Postgres-native follow-ups

| # | Task | Status |
| --- | --- | --- |
| 7.1 | `Float` → `Decimal` for money | **Done in Phase 2**, not deferred. 93 columns, with the boundary described in section 2.1 |
| 7.2 | Case-insensitive search | **Done — and it was a correctness fix, not an enhancement.** SQLite's `LIKE` is case-insensitive for ASCII; Postgres's is not, so all 171 `contains`/`startsWith` filters silently became case-sensitive. Searching "ibra" stopped finding "Ibra". Fixed and verified against the imported data |
| 7.3 | Trigram indexes for search at scale | **Not done.** `ILIKE '%x%'` cannot use a btree index. Irrelevant at 2,777 rows; when client or job counts reach the tens of thousands, add `pg_trgm` and GIN indexes on the searched columns |
| 7.4 | Connection pooling | **Not needed yet.** One app container with Prisma's default pool is appropriate. Add pgbouncer if the app is scaled to several replicas, and set `connection_limit` in `DATABASE_URL` |
| 7.5 | Remaining raw SQL | 47 call sites remain, down from 393. They are legitimate — aggregates, the rate-limiter's atomic upsert, `information_schema` introspection — not schema-probing guards |

## 6. Where things stand

| | Before | After |
| --- | --- | --- |
| Database | SQLite file / Turso libSQL | PostgreSQL 18, containerised |
| Schema management | `db push` + hand-written DDL at runtime | One baseline migration, `migrate deploy` |
| Datamodel vs database | 51 columns missing, 16 unknown, 6 undeclared tables | **Zero drift**, checked by tooling |
| Money | `Float` (`REAL`) | `numeric(18,2)`, `number` at the app boundary |
| Raw SQL call sites | 393 | 47 |
| `lib/prisma.ts` | 382 lines | 175 |
| `app/api/admin/db-fix` | 2,602 lines of runtime DDL | 63 lines, read-only |
| Migration history | none, in any environment | `_prisma_migrations`, applied |
| Deployment | Vercel + Turso | `docker compose up -d` on a VPS |
| Scheduled jobs | Vercel Cron | `scheduler` service |
| Backups | copy the SQLite file | `pg_dump` sidecar, restore drill rehearsed |

Bugs found and fixed along the way that had nothing to do with SQLite:
`recordBillingEvent` was not idempotent despite documenting an idempotency key;
`getPlatformSettings` ran one query per key; `next.config.ts` was missing
`output: "standalone"` while the Dockerfile copied a directory the build never
produced; `/api/health` was session-gated, making the container healthcheck
decorative; and the unit test suite exercised a different Prisma client than
production.

## 7. Verification of the scripts, run after the phases closed

Several scripts were edited during the migration but not executed at the time.
Running them found four more problems, all now fixed:

| Script | Finding |
| --- | --- |
| `qa:perf`, `qa:http-security`, `qa:rate-limit`, `qa:pdf-smoke` | Could not run at all: `bun run build` writes to `.next-gate` off-CI while `bun run start` looked only in `.next`. Fixed by honouring `NEXT_DIST_DIR` and adding `scripts/qa-env.mjs` |
| Same four | Still defaulted `DATABASE_URL` to `file:./dev.db`, so a run without an explicit URL tested nothing |
| `predeploy:check` | Failed its lint step with **63,358 problems** — eslint was linting generated JavaScript in `.next-qa`. `.next-gate` was ignored, the new directory was not. Now globbed as `.next-*` |
| `playwright.config.ts` | Still SQLite-shaped: `ALLOW_SQLITE_PRODUCTION=1`, `prisma db push`, and a `file:` default pointing at the **development** database for a destructive seed |

Two passes that turned out to be worthless until checked:

- **`qa:rate-limit` passed while the `RateLimit` table stayed empty.** The
  limiter falls back to an in-memory window on any error, so the HTTP test passes
  either way. Verified separately that the Postgres path is live: four calls
  against a limit of three give allowed/allowed/allowed/blocked and leave a row
  with `count=4`.
- **`qa:pdf-smoke` "passed" by skipping every check.** It finds a record with an
  unscoped `findFirst`, so with several organisations seeded it picks another
  org's invoice and the correctly org-scoped route returns 404. Against
  single-org data all five PDFs generate (~97KB each) — worth confirming, since
  documents render money.

### End state of the verification suite

| Command | Result |
| --- | --- |
| `bunx tsc --noEmit` | 0 errors |
| `bun run lint` | 0 errors, 107 warnings (pre-existing) |
| `bun run test:unit` | 508 pass, 4 skip, 0 fail |
| `bun run build` | passes |
| `bun run predeploy:check` | passes (lint, build, data-integrity, concurrency, perf, http-security) |
| `bun run qa:data-integrity` / `qa:concurrency` / `qa:perf` / `qa:http-security` / `qa:rate-limit` / `qa:pdf-smoke` | all pass |
| `bun run seed` / `seed:base` / `seed:commercial` | all run |
| `bun run check:links` | passes |
| `bun audit` | 2 pre-existing high advisories in a transitive `effect` package (via `uploadthing` and Prisma's own `@prisma/config`); not introduced here |
| `bun run qa:e2e` | **17 pass, 6 fail — pre-existing UI drift, not database** |
| `smoke:prod` | not runnable without a live production URL |

The six e2e failures are assertions against UI that the design-system work on
`main` changed, and the specs are byte-identical between `main` and this branch.
Evidenced rather than assumed:

- `document-lifecycle` waits for a link named "Create Job Card"; the page
  snapshot shows the search worked and the row rendered, offering "Open job card
  PDF" and "Generate Job Card" instead.
- `authz-smoke` waits for a link named "Settings" that the redesigned navigation
  no longer exposes under that name.
- `viewport-smoke` diffs table header classes (`text-[0.6875rem] uppercase
  tracking-[0.12em]`) introduced by the DataTable redesign.
- `read-only-security` **passes in isolation** — it was flaky in the full run.

Worth fixing, but it is UI-test maintenance, unrelated to the database.
