# SQLite-era one-off migrations

These ran against the Turso/libsql database and were applied before the move to
Postgres. They are kept as a record of what was done to production data, not as
runnable tooling: they import `@prisma/adapter-libsql`, which is no longer a
dependency, and they assume `Float` money columns that are now `Decimal`.

Excluded from `tsconfig.json` for that reason. Do not copy the patterns here into
new scripts — see `AGENTS.md` for the current Postgres runbook.

| script | applied |
| --- | --- |
| `backfill-job-invoice-lines.ts` | care, 2026-08-25 |
