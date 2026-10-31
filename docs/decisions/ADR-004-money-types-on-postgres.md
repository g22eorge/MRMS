# ADR-004: Money is Decimal in the database (supersedes ADR-001)

## Context
ADR-001 (approved 2026-09-23) kept money as `Float` and rejected a migration to
`Decimal` as disproportionate without a failing test. It costed that migration
as "schema + 51 migrations + Turso reconciler + all calculations + seeds".

That costing assumed the migration would happen on SQLite. It did not. The move
to PostgreSQL (branch `feat/postgres-docker-migration`) re-declared every column
for a new provider regardless, and on Postgres a Prisma `Float` is
`double precision` — so the database was going to get *some* explicit numeric
type for each of these columns either way. Choosing `Decimal` at that point cost
what choosing `double precision` cost.

Each item ADR-001 priced was already being paid, or did not arise:

- **Schema / 51 migrations / Turso reconciler** — replaced wholesale by the
  Postgres baseline `prisma/migrations/0_init`. The SQLite migrations are
  archived and the runtime schema repair is deleted, for reasons unrelated to
  money types.
- **All calculations** — not rewritten. Two Prisma extensions in `lib/prisma.ts`
  convert `Decimal` to `number` at the read boundary (`result` for model reads,
  `query` for `aggregate`, `groupBy` and `$queryRaw`), so application code
  still receives plain numbers. `lib/prisma-decimal.ts` is generated from
  `docs/pg-migration/numeric-classification.json`.
- **Seeds** — unchanged; they write plain numbers.

## Problem
With the cost largely gone, the question ADR-001 deferred becomes cheap to
answer, and two pieces of evidence have arrived since it was written:

1. Storage and database-side arithmetic are exact under `numeric` and not under
   `double precision`. Ten payments of 0.10 sum to `1.00` in Postgres `numeric`;
   accumulated as floats they give `0.9999999999999999`. Every report that sums
   money in SQL (`aggregate`, `groupBy`, raw queries) inherits whichever the
   column is.
2. The type does not stay correct by convention. Merging `main` into the
   migration branch on 2026-09-21, three new money columns
   (`Expense.paidAmount`, `ExpensePayment.amount`, `RecurringExpense.amount`)
   arrived as `Float` and merged without a conflict, on a table that tracks
   part-payments against a balance. They were caught by review, not by any test
   or tool. A rule that depends on every author remembering it is the rule
   ADR-001 itself called "UNVERIFIED".

## Options Considered
1. Keep `Float` on Postgres (`double precision`) and add the rounding helper and
   tests ADR-001 calls for.
2. `Decimal` on Postgres, converted to `number` at the Prisma boundary, *plus*
   the rounding tests ADR-001 calls for.
3. Integer minor units (cents) everywhere.

## Decision
PROPOSED: Option 2, as implemented on `feat/postgres-docker-migration`.

| class | type | columns |
| --- | --- | --- |
| money | `Decimal @db.Decimal(18, 2)` | 83 |
| rate (FX, tax) | `Decimal @db.Decimal(12, 6)` | 21 |
| factor (UoM conversion) | `Decimal @db.Decimal(18, 6)` | 5 |
| quantity | `Decimal @db.Decimal(18, 3)` | 4 |
| measure (GPS, targets, limits) | `Float` | 8 |

ADR-001's money-rounding tests are **kept, not superseded**. `Decimal` makes
storage and SQL arithmetic exact; it does nothing for arithmetic the application
does in JavaScript after the boundary has converted to `number`. That is the
half of ADR-001's concern this decision does not address, and its required
rounding cases still gate release.

## Reasons
- The migration cost ADR-001 rejected was mostly incurred by the move to
  Postgres for other reasons; the marginal cost of `Decimal` over
  `double precision` was the conversion boundary, which exists and is generated.
- Exactness where the database does the arithmetic — every SQL-side total —
  comes from the type, not from discipline.
- Option 3 would have required rewriting every calculation and every display
  path, which is the cost ADR-001 was right to refuse.

## Consequences
- **A new money column must be `Decimal`, registered in
  `docs/pg-migration/numeric-classification.json`, with the extension
  regenerated** (`node scripts/pg/generate-decimal-extension.mjs`). Skip the
  registration and TypeScript reports the column as `Decimal` while the code
  treats it as a number: this failed as 16 type errors during the 2026-09-21
  merge, which is the intended loud failure.
- Never call `.toNumber()` on a money field: it is already a number after the
  boundary, and the call throws.
- The `Float` guidance in ADR-001's Consequences ("any new money field must
  follow the rounding helper") no longer describes how money is stored. Its
  rounding-test requirement still applies.
- `main` keeps `Float` until the migration branch merges. Until then, money
  columns added on `main` must be re-typed when they are brought across.

## Alternatives Rejected
- Option 1: leaves SQL-side totals inexact, and keeps correctness dependent on a
  convention that has already failed once in this codebase.
- Option 3: the full rewrite ADR-001 rejected, for no gain over Option 2 at the
  storage layer.

## Date
2026-10-04

## Status
PROPOSED — awaiting owner approval. Supersedes ADR-001 on the storage type only;
ADR-001's rounding-test requirement remains in force. ADR-001 should be marked
"Superseded by ADR-004 (storage type)" when this is approved.
