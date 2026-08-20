#!/usr/bin/env python3
"""
Build the SQLite table-rebuild SQL that makes Client/Device/Job/Part.orgId
NOT NULL and points its foreign key at Organization with ON DELETE CASCADE.

SQLite cannot ALTER a column to add NOT NULL or change a foreign key, so each
table has to be rebuilt: create the new shape, copy the rows, drop the old
table, rename, recreate the indexes. This follows SQLite's documented procedure,
including legacy_alter_table=ON so the RENAME does not rewrite the foreign-key
clauses of the twelve-plus other tables that reference these ones.

Emits SQL only. It does not connect to anything.
"""
import re
import sqlite3
import sys

TABLES = ["Client", "Device", "Job", "Part"]


def table_sql(con, name):
    row = con.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return row[0] if row else None


def index_sqls(con, name):
    return [
        r[0]
        for r in con.execute(
            "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL",
            (name,),
        ).fetchall()
    ]


def orgid_is_notnull(con, name):
    for r in con.execute(f'PRAGMA table_info("{name}")').fetchall():
        if r[1] == "orgId":
            return bool(r[3])
    raise SystemExit(f"{name} has no orgId column")


def org_fk_action(con, name):
    for r in con.execute(f'PRAGMA foreign_key_list("{name}")').fetchall():
        # (id, seq, table, from, to, on_update, on_delete, match)
        if r[3] == "orgId":
            return r[6]
    return None


def rewrite(sql, table, need_notnull, need_fk_change, has_fk):
    """Produce the new CREATE TABLE text, preserving column order."""
    new = sql

    # 1. Point the CREATE at the staging name, keeping the original quoting style.
    new = re.sub(
        r'^CREATE TABLE\s+(IF NOT EXISTS\s+)?"?%s"?' % re.escape(table),
        'CREATE TABLE "%s__mig"' % table,
        new,
        count=1,
        flags=re.I,
    )

    # 2. orgId TEXT [DEFAULT x] -> add NOT NULL directly after the type, which is
    #    where SQLite requires it (before any DEFAULT).
    if need_notnull:
        pattern = r'("orgId"\s+TEXT)(?!\s+NOT\s+NULL)'
        new, n = re.subn(pattern, r"\1 NOT NULL", new, count=1, flags=re.I)
        if n != 1:
            raise SystemExit(f"{table}: could not add NOT NULL to orgId")

    # 3. The foreign key: retarget SET NULL to CASCADE, or add one if absent.
    if has_fk and need_fk_change:
        pattern = (
            r'(FOREIGN KEY\s*\(\s*"orgId"\s*\)\s*REFERENCES\s*"Organization"\s*\(\s*"id"\s*\)[^,)]*?)'
            r"ON DELETE SET NULL"
        )
        new, n = re.subn(pattern, r"\1ON DELETE CASCADE", new, count=1, flags=re.I | re.S)
        if n != 1:
            raise SystemExit(f"{table}: could not retarget the Organization foreign key")
    elif not has_fk:
        # Append a new table-level constraint before the final closing paren.
        idx = new.rfind(")")
        if idx == -1:
            raise SystemExit(f"{table}: malformed CREATE TABLE")
        new = (
            new[:idx]
            + ', FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE'
            + new[idx:]
        )

    return new


def main(db_path):
    con = sqlite3.connect(db_path)
    out = []
    out.append("PRAGMA foreign_keys=OFF;")
    # Keeps ALTER TABLE ... RENAME from rewriting the FK clauses of every other
    # table that references these ones.
    out.append("PRAGMA legacy_alter_table=ON;")
    out.append("BEGIN;")

    changed = []
    for t in TABLES:
        sql = table_sql(con, t)
        if not sql:
            print(f"-- {t}: table absent, skipped", file=sys.stderr)
            continue

        need_nn = not orgid_is_notnull(con, t)
        action = org_fk_action(con, t)
        has_fk = action is not None
        need_fk = has_fk and action.upper() != "CASCADE"

        if not need_nn and has_fk and not need_fk:
            print(f"-- {t}: already correct, skipped", file=sys.stderr)
            continue

        changed.append(t)
        idx_sqls = index_sqls(con, t)
        cols = [r[1] for r in con.execute(f'PRAGMA table_info("{t}")').fetchall()]
        collist = ", ".join(f'"{c}"' for c in cols)

        out.append(f"-- ── {t}: notnull={need_nn} fk={'retarget' if need_fk else ('add' if not has_fk else 'ok')}")
        out.append(rewrite(sql, t, need_nn, need_fk, has_fk) + ";")
        out.append(f'INSERT INTO "{t}__mig" ({collist}) SELECT {collist} FROM "{t}";')
        out.append(f'DROP TABLE "{t}";')
        out.append(f'ALTER TABLE "{t}__mig" RENAME TO "{t}";')
        for isql in idx_sqls:
            out.append(isql.rstrip().rstrip(";") + ";")

    out.append("COMMIT;")
    out.append("PRAGMA foreign_keys=ON;")
    con.close()

    print("\n".join(out))
    print(f"-- tables rebuilt: {', '.join(changed) if changed else 'none'}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
