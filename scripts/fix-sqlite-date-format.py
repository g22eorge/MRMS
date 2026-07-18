#!/usr/bin/env python3
"""
Convert DateTime columns in a local SQLite copy of the production (Turso/libsql)
database from TEXT ISO-8601 (libsql adapter format, e.g. '2026-07-09T16:38:00.123+00:00')
to INTEGER milliseconds-since-epoch (Prisma native SQLite engine format).

Why: production writes dates as TEXT via @prisma/adapter-libsql, but local dev uses
Prisma's native engine, which binds DateTime parameters as INTEGER ms. SQLite orders
any INTEGER below any TEXT, so on a synced prod copy:
  - `col >= <date>` filters match EVERY text row  (Clients "New this month" showed 77/77)
  - `col >= X AND col <= Y` ranges match NOTHING  (Reports & AI Insights showed UGX 0)

Run AFTER each prod->dev sync:  python3 scripts/fix-sqlite-date-format.py [path/to/dev.db]

The column list is parsed from prisma/schema.prisma. Idempotent: only touches rows
where typeof(col) = 'text'.
"""
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "prisma" / "dev.db"

schema = (ROOT / "prisma" / "schema.prisma").read_text()
models = re.findall(r"model (\w+) \{(.*?)\n\}", schema, re.S)

db = sqlite3.connect(DB)
existing_tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}

total = 0
with db:  # single transaction
    for model, body in models:
        if model not in existing_tables:
            continue
        table_cols = {r[1] for r in db.execute(f'PRAGMA table_info("{model}")')}
        for col in re.findall(r"^\s*(\w+)\s+DateTime", body, re.M):
            if col not in table_cols:
                continue
            cur = db.execute(
                f'UPDATE "{model}" SET "{col}" = CAST(ROUND((julianday("{col}") - 2440587.5) * 86400000) AS INTEGER) '
                f'WHERE typeof("{col}") = \'text\''
            )
            if cur.rowcount:
                total += cur.rowcount
                print(f"{model}.{col}: {cur.rowcount} rows")

print(f"\nConverted {total} text date values to integer ms.")
db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
db.close()
