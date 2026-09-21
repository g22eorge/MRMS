# Archived SQLite migrations

These 48 migration folders describe the SQLite history of the database, from
`20260401142821_init` to the last pre-Postgres change. They are kept for
historical reference only and are **not** applied by `prisma migrate deploy`.

They cannot be replayed against Postgres:

- 26 of them contain `PRAGMA defer_foreign_keys` and 28 contain
  `PRAGMA foreign_keys`, statements Postgres does not have.
- Several use SQLite's table-rebuild idiom (create `new_X`, copy, drop, rename)
  to emulate `ALTER COLUMN`, which Postgres does natively.

They were also never the source of truth. Neither the production database nor
the development database had a `_prisma_migrations` table: both were built with
`prisma db push` plus hand-written DDL repair. So there is no applied-migration
history to preserve, and the Postgres side starts from a single generated
baseline (`prisma/migrations/0_init`) produced from the datamodel.
