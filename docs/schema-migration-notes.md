# Schema migration notes (phase-0 batch)

These schema changes are applied to the local dev DB via `bun run db:push`. They are
**not yet applied to production** (Turso). Apply them deliberately — one is additive
and safe, one adds a unique index and must be dup-checked first.

## 1. `Sale.taxApplicable Boolean @default(true)` — SAFE (additive)

Fixes M7: VAT intent is now persisted so later edits/discounts stop force-enabling VAT.

- Additive nullable-equivalent column with a default → no existing-row conflict.
- Existing sales default to `true`, preserving the previous "VAT on edit" behaviour.
- Production: apply via the normal schema-sync/db-fix path. No backfill needed.

## 2. `Receipt @@unique([orgId, paymentId])` — REQUIRES A DUP-CHECK FIRST

Fixes H14 (partial): makes "one receipt per payment" a DB guarantee instead of a
racy app-level check. `createReceiptForPayment` now also catches P2002 and returns
the existing receipt, so a concurrent create never 500s.

`paymentId` is nullable, and SQLite/libSQL treat NULLs as distinct, so multiple
receipts with `paymentId = NULL` remain allowed — only non-null payment ids are
constrained.

**Before applying to production, run the duplicate check** (the migration will FAIL
if any duplicate exists):

```sql
SELECT orgId, paymentId, COUNT(*) c
FROM Receipt
WHERE paymentId IS NOT NULL
GROUP BY orgId, paymentId
HAVING c > 1;
```

- If it returns 0 rows → safe to apply.
- If it returns rows → dedup first (keep the earliest receipt per (orgId, paymentId),
  delete/void the rest) before adding the constraint.

Note: on SQLite/libSQL, adding a column or unique index rebuilds the table, so
`prisma db push` warns about data loss (`--accept-data-loss`). On an intact DB this
is a rebuild, not a loss — but production should apply through the reviewed db-fix /
migration path, never a blind `--accept-data-loss` against live data.

## Still pending (not in this batch — larger/cross-model)

- **M15** — `Department.orgId` + `@@unique([orgId, code])`: needs a back-relation on
  Organization and a backfill of `orgId` for existing rows (assign each department to
  an org). Deferred — needs the backfill decision.
- **M6** — `PartStockTransaction` `orgId` / `locationId` / `unitCost` / source ref:
  additive, but `orgId` should be backfilled from `part.orgId` for existing rows.
- **H14 (relations)** — converting `Receipt`'s loose FKs to `@relation` with `onDelete`
  touches Payment/Sale/Invoice/Client (back-relations). Deferred — cross-model.
- **H1-invoice** — `InvoiceLine.partId` + decrement invoiced goods on finalization
  (with reversal on void/credit). Additive column, but the decrement/reversal logic is
  a feature; deferred.
