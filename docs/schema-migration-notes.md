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

## 3. `DocumentSequence` model (H7) — SAFE (additive table)

New table backing the atomic document-number counter. Additive — creating an empty
table has no effect on existing data. The counter lazy-initialises from the current
max on first use per (type, year), so numbering continues seamlessly. No backfill.

## 4. `Department.orgId` + `@@unique([orgId, code])` (M15) — additive column + REQUIRES BACKFILL

- `orgId` is nullable, so adding it does not break existing rows.
- The unique constraint moves from `code` (global) to `([orgId, code])`. This can only
  fail if two departments share a code within the same org (or both null) — unlikely;
  check with:
  ```sql
  SELECT orgId, code, COUNT(*) c FROM Department GROUP BY orgId, code HAVING c > 1;
  ```
- **Backfill:** legacy departments have `orgId = NULL`. The app shows them transitionally
  (org's own + nulls), but you should assign them:
  ```bash
  DATABASE_URL=... node scripts/backfill-department-org.mjs <careOrgId> --dry-run
  DATABASE_URL=... node scripts/backfill-department-org.mjs <careOrgId>
  ```
  For single-tenant care, pass the care org id (all departments belong to it).

## 5. `Receipt` relations (H14) — DONE (adds FK constraints on existing columns)

Receipt's loose FKs (payment/sale/invoice/branch/client/issuedBy) are now real
`@relation`s with `onDelete: SetNull`. Prod note: adding the FK constraints can
fail if orphan receipts already reference missing parents — check/clean first
(dev had 0 receipts).

## H1-invoice — DONE, no schema change

Invoiced goods now decrement stock. No `InvoiceLine.partId` column was needed —
lines already carry the part via `sourceType = "Part"` / `sourceId`. Standalone
product invoices decrement on issue and restore on void; repair invoices
(`sourceType = "QuotationItem"`) are consumed at job completion instead, so there
is no double-count.

## Still pending

- **M6** — `PartStockTransaction` `orgId` / `locationId` / `unitCost` / source ref:
  additive, but `orgId` should be backfilled from `part.orgId` for existing rows.
  Lower value (ledger enrichment); not yet done.
