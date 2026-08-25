# One-off production schema migrations

`prisma/schema.prisma` is the source of truth, and a database created from it
already has the right shape. These scripts exist for databases that were created
*before* a constraint was added and therefore need a one-off repair —
`app/api/admin/db-fix/route.ts` can add tables, columns and indexes, but SQLite
cannot `ALTER` a column to add `NOT NULL` or change a foreign key, so those need
a full table rebuild.

Applied migrations are kept here for auditability. They are not re-run
automatically and are not part of the build.

---

## `orgid-notnull-cascade` — applied 2026-08-19

Makes `orgId` `NOT NULL` on `Client`, `Device`, `Job` and `Part`, and points each
one's foreign key at `Organization` with `ON DELETE CASCADE`.

Before this, `orgId` was nullable with `ON DELETE SET NULL` (or, on the care
database, no foreign key at all). A null there made a record invisible to every
organisation while still existing — a job nobody could open, still reachable from
the public status page and still counted by the job-number generator.

### What it does

SQLite's documented table-rebuild procedure: create the new shape, copy the rows,
drop the old table, rename, recreate the indexes. `build-migration.py` reads a
database's actual schema and emits the SQL, so the generated statements match
whatever that database really had rather than an assumption.

```bash
turso db export <db> --output-file backup.db      # always, first
python3 orgid-notnull-cascade.py backup.db > migration.sql
turso db shell <db> < migration.sql
```

### Turso caveat

Turso rejects `PRAGMA legacy_alter_table=ON`, which SQLite's procedure normally
uses to stop `ALTER TABLE ... RENAME` from rewriting the foreign-key clauses of
other tables. The committed `.sql` files have that pragma stripped. This was
verified safe on a `turso db branch` copy of production first: all row counts
held, every dependent table still referenced the rebuilt tables, and
`PRAGMA foreign_key_check` came back clean.

`PRAGMA foreign_keys=OFF` is accepted but silently ignored — it still reads back
as `1`. The rebuild was checked against that behaviour on the branch (dropping a
parent table did not cascade into its dependents) before being applied for real.

### Result

| Database | Deployment | Tables rebuilt |
|---|---|---|
| `mrms-prod` | care.eagleinfosolutions.com | Client, Device, Job, Part |
| `repairmanager` | app.eagleinfosolutions.com | Client, Device, Job, Part |

Verified afterwards on both: row counts unchanged, index counts unchanged,
`foreign_key_check` clean, per-tenant client counts unchanged, and the live app
reading and writing normally.

---

## `creditnote-invoice-parent` — applied 2026-08-25

Makes `CreditNote.saleId` nullable and adds `CreditNote.invoiceId`, so a credit
note can be raised against an invoice as well as a POS sale.

`app/api/admin/db-fix` adds the `invoiceId` column on its own, which is enough
for every READ path — the credit-note and refund screens keep working. What
still needs this rebuild is relaxing `saleId` from `NOT NULL`, which SQLite
cannot do in place. Until it runs, creating an **invoice-sourced** credit note
is the only thing that fails.

```bash
turso db export <db> --output-file backup.db --overwrite
python3 creditnote-invoice-parent.py backup.db > migration.sql
turso db shell <db> < migration.sql
```

Rehearsed on exact copies of both databases and then on a `turso db branch` of
`repairmanager` (the harder case — it holds a live credit note and had no
`invoiceId` column). Applied to both.

| Database | Deployment | Before | After |
|---|---|---|---|
| `mrms-prod` | care.eagleinfosolutions.com | 0 credit notes, `invoiceId` already added by db-fix | `saleId` nullable |
| `repairmanager` | app.eagleinfosolutions.com | 1 credit note + 1 item, no `invoiceId` | `saleId` nullable, `invoiceId` added |

Verified after: row counts unchanged on `CreditNote`, `CreditNoteItem` and
`Refund`; `foreign_key_check` clean on both; the list query and picker query the
app actually runs both succeed against the migrated schema; and on the branch, a
new invoice-sourced credit note inserts while the existing sale-sourced one
still resolves its parent.

---

## `backfill-job-invoice-lines` — applied to care 2026-08-25

Itemises job invoices written before repairs carried invoice lines. A job
invoice used to record only a total, so it could not be credited line by line
and the PDF printed a subtotal no line accounted for.

```bash
turso db export <db> --output-file backup.db --overwrite
TDB=<libsql url> TTOK=<token> bun run scripts/migrations/backfill-job-invoice-lines.ts          # dry run
TDB=<libsql url> TTOK=<token> bun run scripts/migrations/backfill-job-invoice-lines.ts --apply
```

Only touches invoices with ZERO lines, so it is idempotent and never disturbs
one itemised by hand. It never writes `Invoice.totalAmount` — lines are derived
from it — and verifies `subtotal + tax == totalAmount` per invoice, rolling back
any that fails.

It itemises against the **invoice's own total**, not the job's current
`clientBill`: for a historical document the invoice is the record of what was
billed. Not academic — `EIS/INV/2026/0042` on care carries 185,000 against a job
whose bill was later revised to 395,000, and using the job figure would have
written lines contradicting the total. The script logs that case rather than
hiding it.

**care result:** 66 of 66 itemised, invoice sum and count unchanged (65,977,536
across 89), `InvoiceLine` rows 36 -> 102, zero job invoices left without lines,
zero invoices whose lines disagree with their total, `foreign_key_check` clean.
Creditable paid invoices went from 5 to 59.

**repairmanager result (2026-08-25):** 3 of 3 itemised, invoice sum unchanged at
845,000 across 3, zero job invoices left without lines, zero mismatches,
`foreign_key_check` clean. Two tenants affected — Eagle Info Solutions and
Akimaathe Kyarumba Foundation — and the per-tenant VAT difference came through
correctly: the two VAT-applicable jobs split into an ex-VAT line plus tax, while
the third carried its full amount with zero tax.

All three are still `ISSUED` and unpaid, so nothing is creditable there yet —
the lines are in place for when they are settled.

### `EIS/INV/2026/0042` — corrected 2026-08-25

The invoice was issued at 185,000 and the job's bill afterwards revised to
395,000 without the invoice being reissued, so the document understated what the
customer (Nangai Moses) owed by 210,000.

Corrected to 395,000 on the owner's instruction. It was a clean reissue rather
than a restatement of settled money: nothing was attached to it — no payments,
refunds, credit notes, delivery notes or receipts — and being unpaid it had no
ledger entries, the books being cash-basis. The total was taken from
`Job.clientBill` and the lines rebuilt from it, exactly as the live invoicing
path does.

Verified after: invoice total, job bill and the sum of its lines all agree at
395,000; care's invoice sum moved 65,977,536 -> 66,187,536, exactly the +210,000
expected; no invoice anywhere still disagrees with its job's bill; no invoice's
lines disagree with its total; payments untouched at 85; `foreign_key_check`
clean. A `SystemAuditEvent` records the change.

---

## Per-tenant document codes — set 2026-08-25

All seven organisations on `repairmanager` shared the code `EIS`, so Akimaathe
Kyarumba Foundation — a paying customer — was issuing documents prefixed with
Eagle Info Solutions' code.

Codes set, derived from each name:

| Tenant | Code |
|---|---|
| Akimaathe Kyarumba Foundation | `AKF` |
| Eagle Info Solutions (platform, `org_eis_01`) | `EIS` |
| Elite Digital | `ELD` |
| FixIt Fast Ghana | `FFG` |
| TechFix Uganda | `TFU` |
| iRepair Kenya | `IRK` |

Existing documents keep their numbers; only future ones use the new code. care
is unchanged on `EIS`.

### The `singleton` branding row, and the seventh org

A second organisation also named "Eagle Info Solutions" (slug
`eagle-info-solutions`, created 8 May 2026) held **0 users, 0 clients and 2 paid
sales** — and it **owned the `singleton` branding row**, the shared fallback any
org without its own branding inherits. Writing a code for that org would have
written it into every other org's default.

Two changes, both deliberate:

* `singleton.orgId` set to `NULL`, so the fallback belongs to nobody. The org
  now derives `EAGLE-INFO-SOLUTIONS` from its slug, which is the intended
  behaviour for an org with no branding row of its own.
* The org retired with `isActive: false`, `billingStatus: CANCELLED` and
  `planCancelledAt` stamped — **not deleted**. 32 tables cascade from
  `Organization`, so a delete would have destroyed its two paid sales.
  `isActive: false` makes it read-only through the suspension guard
  (`lib/billing-access.ts`) while every record survives.

Verified after: 6 active tenants with 6 distinct codes and no sharing; sales
still 4 and invoices still 3 summing 845,000; `foreign_key_check` clean; care
untouched at 1 org, code `EIS`, 89 invoices.
