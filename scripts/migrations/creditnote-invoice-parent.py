#!/usr/bin/env python3
"""
Make CreditNote.saleId nullable and add CreditNote.invoiceId, so a credit note
can be raised against an invoice as well as a POS sale.

`ALTER TABLE ADD COLUMN` covers invoiceId, and app/api/admin/db-fix already does
that much — which is enough for every READ path. What needs a full table
rebuild is relaxing saleId from NOT NULL, because SQLite cannot do that in
place. Until this runs, an invoice-sourced credit note fails to insert.

Follows SQLite's documented rebuild: create the new shape, copy the rows, drop
the old table, rename, recreate the indexes. Emits SQL only; it connects to
nothing.

Turso caveats (learned on the orgId migration, see README):
  * PRAGMA legacy_alter_table=ON is rejected — omitted here. Safe because the
    staging table is renamed INTO the real name, and nothing references the
    staging name.
  * PRAGMA foreign_keys=OFF is accepted but silently ignored. Verified on a
    branch that the drop does not cascade into CreditNoteItem or Refund.

Usage:
    turso db export <db> --output-file backup.db --overwrite
    python3 creditnote-invoice-parent.py backup.db > migration.sql
    turso db shell <db> < migration.sql
"""
import re
import sqlite3
import sys

TABLE = "CreditNote"


def main(db_path):
    con = sqlite3.connect(db_path)

    row = con.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (TABLE,)
    ).fetchone()
    if not row:
        raise SystemExit(f"{TABLE} not found in {db_path}")
    create_sql = row[0]

    cols = [r[1] for r in con.execute(f'PRAGMA table_info("{TABLE}")').fetchall()]
    already_nullable = not any(r[1] == "saleId" and r[3] for r in con.execute(f'PRAGMA table_info("{TABLE}")').fetchall())
    has_invoice = "invoiceId" in cols
    if already_nullable and has_invoice:
        print(f"-- {TABLE} already has a nullable saleId and an invoiceId; nothing to do", file=sys.stderr)
        return

    idx_sqls = [
        r[0]
        for r in con.execute(
            "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL",
            (TABLE,),
        ).fetchall()
    ]

    new = create_sql
    new = re.sub(
        r'^CREATE TABLE\s+(IF NOT EXISTS\s+)?"?%s"?' % re.escape(TABLE),
        f'CREATE TABLE "{TABLE}__mig"',
        new,
        count=1,
        flags=re.I,
    )

    # saleId TEXT NOT NULL -> saleId TEXT
    new, n = re.subn(r'("saleId"\s+TEXT)\s+NOT\s+NULL', r"\1", new, count=1, flags=re.I)
    if n != 1 and not already_nullable:
        raise SystemExit("could not relax saleId to nullable")

    # add invoiceId + its foreign key when the column is not already there
    if not has_invoice:
        new = re.sub(r'("saleId"\s+TEXT)(\s*,)', r'\1\2\n        "invoiceId" TEXT,', new, count=1, flags=re.I)
        idx = new.rfind(")")
        new = (
            new[:idx]
            + ', FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE'
            + new[idx:]
        )
        cols_out = cols + ["invoiceId"]
        select_cols = ", ".join(f'"{c}"' for c in cols) + ", NULL"
    else:
        cols_out = cols
        select_cols = ", ".join(f'"{c}"' for c in cols)

    collist_out = ", ".join(f'"{c}"' for c in cols_out)

    out = [
        "PRAGMA foreign_keys=OFF;",
        "BEGIN;",
        new + ";",
        f'INSERT INTO "{TABLE}__mig" ({collist_out}) SELECT {select_cols} FROM "{TABLE}";',
        f'DROP TABLE "{TABLE}";',
        f'ALTER TABLE "{TABLE}__mig" RENAME TO "{TABLE}";',
    ]
    out += [s.rstrip().rstrip(";") + ";" for s in idx_sqls]
    out.append(f'CREATE INDEX IF NOT EXISTS "{TABLE}_invoiceId_idx" ON "{TABLE}"("invoiceId");')
    out.append("COMMIT;")
    out.append("PRAGMA foreign_keys=ON;")

    con.close()
    print("\n".join(out))
    print(f"-- rebuilt {TABLE}: saleId nullable, invoiceId {'added' if not has_invoice else 'present'}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
