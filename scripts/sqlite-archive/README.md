# Turso-era operational scripts

One-off maintenance scripts written against the Turso/libsql database. They open
a `@libsql/client` connection to a database that no longer exists, and they
address money columns as `Float` where the datamodel now declares `Decimal`.

Kept as a record of what was run against production, not as runnable tooling.
Nothing references them — not `package.json`, not the docs. For anything
equivalent today, write a Prisma script against `DATABASE_URL` and put schema
changes in a migration; see `AGENTS.md`.
