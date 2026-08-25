# Production cutover: SQLite/Turso → Postgres on Docker

Everything in this document has been rehearsed against the production snapshot
except the two steps that need the live systems: taking the final dump, and
switching DNS. Timings below are from the rehearsal (2,777 rows).

**Status:** the whole data path has been run against the export of 2026-08-25
(4,103 rows, newest row 2026-08-24) — validated, imported, verified, and served
by the application inside the Docker stack. See the Phase 6 section of
`postgres-migration-plan.md` for the figures.

What remains is only what needs the live systems: provisioning the VPS, freezing
writes, and taking the **final** export. The one in the repo is a day old, so
anything written since would be lost — the commands below are unchanged and now
proven against real current data.

## Before the window

1. **Provision the VPS.** Docker and the compose plugin; a TLS-terminating
   reverse proxy (Caddy or nginx) in front of the app's published port.
2. **Check out the repo and configure it.**
   ```bash
   cp .env.docker.example .env
   ```
   Fill in every value marked required. `POSTGRES_PASSWORD`,
   `BETTER_AUTH_SECRET` and `CRON_SECRET` should each be 32+ random characters —
   compose refuses to start without them.
3. **Bring the stack up empty and confirm it is healthy.**
   ```bash
   docker compose up -d --build
   docker compose ps            # app must read (healthy)
   curl -fsS https://<host>/api/health
   ```
   This proves the image, the migrations, the proxy and TLS all work *before*
   any data is involved.
4. **Dry-run the import** against the old snapshot to confirm the tooling runs on
   this machine:
   ```bash
   docker compose run --rm --no-deps -v "$(pwd)/mrms-prod.db:/app/mrms-prod.db:ro" \
     migrate node scripts/pg/import.mjs mrms-prod.db --check
   ```

## The window

Rehearsed duration for the data steps: **under two minutes**. Budget 30 for the
whole window.

5. **Announce and freeze writes.** Stop the old deployment, or put it behind a
   maintenance page. The point is that no new row is created after the dump.

6. **Take the final dump** from the live Turso database. `@libsql/client` is
   already a dependency, so no extra CLI is needed:
   ```bash
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/pg/dump-turso.mjs final.db
   ```
   > This script is the one piece not yet written, because it needs live
   > credentials to test against. Alternatively export with whatever tool you
   > already use — every downstream step takes a plain SQLite file path.

7. **Fingerprint the dump.** This is what the import is verified against, so it
   must come from the same file:
   ```bash
   node scripts/pg/baseline.mjs final.db --out docs/pg-migration/baseline.final.json
   node scripts/pg/drift-report.mjs final.db
   ```

8. **Validate before writing anything.**
   ```bash
   docker compose run --rm --no-deps -v "$(pwd)/final.db:/app/final.db:ro" \
     migrate node scripts/pg/import.mjs final.db --check
   ```
   Against the 2026-08-25 export this reports exactly one finding, the known
   `Job.invoiceNumber` policy (14 duplicated values, 16 surplus rows).
   **A new finding means stop and read it** — the resolvers in
   `docs/pg-migration/import-map.json` cover only what has been analysed.

9. **Import.**
   ```bash
   docker compose run --rm --no-deps -v "$(pwd)/final.db:/app/final.db:ro" \
     migrate node scripts/pg/import.mjs final.db --truncate --resolve-duplicates
   ```
   Every duplicate resolution is printed. **Keep that output** — it is the record
   of which rows were changed and why.

10. **Verify, twice, and do not skip this.**
    ```bash
    docker compose run --rm --no-deps -v "$(pwd)/docs:/app/docs:ro" \
      migrate node scripts/pg/verify-import.mjs docs/pg-migration/baseline.final.json
    docker compose run --rm --no-deps migrate bun scripts/pg/verify-business.ts
    ```
    The first compares row counts, the sum of every numeric column and the
    min/max of every timestamp. The second checks the result is usable:
    relationships resolve, enums are valid, money reads as numbers. Adjust the
    expected figures in `verify-business.ts` to the new dump's totals first, or
    read its failures as "these differ from July", which is expected.

    **Any unexplained discrepancy: stop.** Nothing has been switched over yet.

11. **Point traffic at the new stack** (DNS or proxy upstream) and smoke-test by
    hand, not just by script:
    - log in
    - open a job, change its status, confirm the Messages tab shows the attempt
    - record a payment, confirm the receipt and the totals
    - generate an invoice PDF
    - search a client by lowercase name (this was a real regression — see the
      case-insensitivity fix)
    - `/api/admin/db-health` — must report `inSync: true`

12. **Confirm the scheduler is alive.** Four jobs stop silently if it is not:
    ```bash
    docker compose logs scheduler | tail
    ```

13. **Take a backup immediately** and copy it off the host:
    ```bash
    docker compose exec backup pg_dump -Fc -f /backups/post-cutover.dump
    docker compose cp backup:/backups ./backups-local
    ```

14. **Lift the freeze.**

## After

- Keep the old Turso database **read-only for at least 7 days** as the rollback
  path, and archive `final.db` somewhere off the VPS.
- Run the restore drill in `docs/deployment.md` once, on the real server, in the
  first week. A backup that has never been restored is a hypothesis.
- Only then decommission Turso, delete `mrms-prod.db` and
  `prisma/migrations-sqlite-archive/`, and drop `@libsql/client` from
  devDependencies.

## Rollback

Before step 11 nothing has changed for users: stop the new stack and lift the
freeze on the old deployment.

After step 11, rolling back means losing anything written to Postgres since the
switch. Repoint traffic at the old deployment, then reconcile by hand from the
audit log. This is the reason for the write freeze and for verifying at step 10
rather than after.
