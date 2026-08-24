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

## `creditnote-invoice-parent` — pending

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

Rehearsed against the 19 Aug production snapshots of both databases: row counts
held (`CreditNote`, `CreditNoteItem`, `Refund`), `integrity_check` ok,
`foreign_key_check` clean, and afterwards both an invoice-sourced and a
sale-sourced credit note insert successfully with foreign keys enforced.
