# Production cutover: SQLite/Turso → Postgres on Docker

## Status (2026-10-26)

The Docker stack is live on the shared Eagle Stays VPS. Today's dump is in
Postgres. **Users still hit Vercel + Turso.** Do not treat
`http://141.136.44.99:3010` as production.

### Done

- GitHub Actions `Deploy` on `feat/postgres-docker-migration` (GHCR pull, no
  build on the 1 vCPU box). Path `/var/www/mrms`. Port **3010**.
- `ENV_CI` + `SERVER_*` + `DEPLOY_PATH` secrets on `g22eorge/MRMS`.
- CSP: no `upgrade-insecure-requests` while the public URL is `http://`.
  Image `4eb1e2c9`. Open **http://** not https on :3010.
- Import of `mrms-prod.db-2` (SHA `6d533801…`, written 2026-10-26): 8,338 rows,
  11 users, 143 clients, 129 jobs, 169 invoices, 191 payments. Last audit
  2026-10-26 07:31 UTC. Eight `Receipt.paymentId` orphans nulled (documented
  `nullOrphan` policy).
- WhatsApp / Resend / Pesapal left blank in `ENV_CI` so the scheduler does not
  message real clients from this stack.

`verify-business.ts` still compares to the September baseline; count/money
mismatches are the newer dump, not a failed import.

### What remains (do in this order)

1. **Smoke the VPS** at `http://141.136.44.99:3010` with a production login:
   open a job and change status (Messages tab); record a payment; open an
   invoice PDF; search a client in lowercase; `/api/admin/db-health` in sync.
   Vercel is still source of truth — do not run the shop on :3010 yet.

2. **Data freeze (decision).** Anything written on Vercel after
   `mrms-prod.db-2` is not on the VPS. Before DNS: freeze Vercel writes, take a
   final Turso dump, re-import with `--truncate`. Or accept this dump and lose
   later rows.

3. **TLS + hostname (built, see "Routing care through the shared nginx"
   below).** Not a Cloudflare origin cert: eagleinfosolutions.com is on
   Netlify DNS with no Cloudflare proxy, so a browser would reject one. MRMS's
   `certbot` service gets a Let's Encrypt certificate by itself once DNS
   points here. Needs eaglestays branch `feat/shared-nginx-includes` merged to
   its `main` once.

4. **The window.** Freeze Vercel writes; final Turso dump; re-import with
   `--truncate`; verify. Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to
   `https://care.eagleinfosolutions.com` in `ENV_CI` and redeploy — from here
   login over `http://141.136.44.99:3010` stops working (Secure cookie), which
   is expected. Lower the `care` TTL to 300 in Netlify an hour before. Then in
   Netlify DNS replace the `care` CNAME with `A 141.136.44.99`. Keep Vercel
   frozen until the nginx access log shows the traffic has moved.

5. **After the switch.** Restore `upgrade-insecure-requests` in the CSP;
   disable git deploys on Vercel project `mrms`; merge
   `feat/postgres-docker-migration` to `main` and add `main` to `deploy.yml`;
   copy WhatsApp/Resend into `ENV_CI`; run `scripts/backup-db.sh` and copy the
   dump off the box; keep Turso read-only ~7 days.

   `app.eagleinfosolutions.com` (Vercel project `mrms-apga`, the commercial
   product) is **not** part of this switch. One stack runs in one mode, and
   `BETTER_AUTH_URL=https://care…` forces single-tenant for every hostname it
   serves (`lib/deployment-context.ts`). Moving `app.` needs its own stack and
   its own data. Until then, make sure merging to `main` does not ship
   Postgres-only code to `mrms-apga`.

### Routing care through the shared nginx

eaglestays' nginx container owns 80/443 on this box. It includes every
`*.conf` in `/var/www/edge/nginx` (one-time change on eaglestays, branch
`feat/shared-nginx-includes`). Everything else is owned and deployed by this
repo:

| Piece | Where | What it does |
| --- | --- | --- |
| `deploy/edge/care.conf` | → `/var/www/edge/nginx/mrms-care.conf` | :80 serves the ACME webroot and redirects; :443 proxies to `host.docker.internal:3010`, forwarding `Host` |
| `scripts/edge/install-nginx-conf.sh` | run by `deploy.yml` | copies the block in, runs `nginx -t`, reloads; on failure restores the previous file and fails the deploy. Skips with a warning if eaglestays has not merged its change yet |
| `certbot` service (profile `edge`) | `docker-compose.yml` | resolves the hostname through 1.1.1.1 (not the host's resolver, whose provider cache held the old record for an hour at the care switch) and fetches `/.well-known/acme-challenge/<token>` from that IP every 60s; once its own token comes back (DNS + nginx both route here) it issues, then renews twice a day. Publishes to `/var/www/edge/certs` with the key `root:101 0640` for nginx's worker |

Properties to rely on:

- nginx loads care's certificate at handshake time, so a missing certificate
  fails care's handshakes only. eaglestays.ug and nginx itself are unaffected,
  and nothing needs a reload when the certificate arrives or renews.
- The probe exists because Let's Encrypt allows 5 failed validations per
  hostname per hour. Calling certbot blind while DNS still points at Vercel
  would exhaust that, and the real issuance right after the switch would be
  refused for up to an hour.
- Expect care's https to fail for about 1–2 minutes after the DNS flip, until
  the server's resolver sees the new record and the certificate lands.
- The app port (3010) is published on the docker0 address only (`APP_BIND`,
  set by `deploy.yml`), so `http://141.136.44.99:3010` is closed to the
  internet; nginx reaches it through `host.docker.internal`.
- Every eaglestays deploy runs `compose down && up`, which briefly takes care
  down too. Shared front door, shared restarts.

Check it:

```bash
$DOCKER compose logs --tail 20 certbot          # "DNS does not point here yet" until the flip
curl -sI --resolve care.eagleinfosolutions.com:443:141.136.44.99 https://care.eagleinfosolutions.com/api/health
```

Command detail for dump/import/DNS is still below (steps 5–14 of the original). Skip 1–4 of
the old order — they are done.

---

Everything in the original procedure was rehearsed against earlier snapshots.
Timings below are from the rehearsal (2,777 rows). See Phase 6 of
`postgres-migration-plan.md` for those figures. Any dump older than the freeze
is stale by definition.

## Where this runs

The same server as eaglestays (1 vCPU, 3.8 GB). Three facts about that box decide
everything below:

- **eaglestays' nginx publishes 80 and 443 itself.** Its Traefik edge proxy
  exists only on its branch `feat/traefik-edge`, never merged, so
  `docker-compose.shared-edge.yml` here has nothing to attach to yet. Until a
  routing decision is made (see step 11), MRMS is reachable only on
  `http://<server-ip>:<APP_PORT>`.
- **eaglestays' deploy runs `compose down` in `/var/www/eagle-info` on every
  run.** MRMS lives in `/var/www/mrms`; `deploy.yml` refuses the other path.
- **The deploy user runs Docker through `sudo -n /usr/bin/docker`**, not the
  docker group. Every command below that says `$DOCKER` means that:
  ```bash
  DOCKER="sudo -n /usr/bin/docker"
  ```
  `scripts/backup-db.sh` and `scripts/restore-db.sh` read the same variable.

The server never builds. `.github/workflows/deploy.yml` tests the branch, builds
one image per service on GitHub's runners, pushes them to GHCR tagged by commit,
then SSHes in and runs `compose pull` + `compose up -d --no-build`.

## Order of operations, and why

`main` still deploys to Vercel (projects `mrms` and `mrms-apga`) on every push.
So the branch is deployed and proven first, and `main` is merged **last**:

1. Deploy `feat/postgres-docker-migration` to the server on its own port.
2. Import a recent snapshot there; test on `http://<ip>:<APP_PORT>`.
3. Decide routing for 80/443 (step 11) and have it ready, pointed at nothing.
4. The window: freeze, final Turso dump, import, verify.
5. Switch DNS.
6. Disable Vercel git deployments for both projects.
7. Merge to `main`, and add `main` to `deploy.yml`'s trigger in the same PR.
8. Lift the freeze.

Merging before step 6 would ship Postgres code to a Vercel deployment that has
no Postgres, and production would go down at the moment of the merge rather
than the moment of the switch.

## Before the window

1. **One-time server setup**, as the deploy user:
   ```bash
   sudo mkdir -p /var/www/mrms && sudo chown "$USER" /var/www/mrms
   ```
   GitHub Actions must be running on this repository; it has recorded no runs
   since 2026-05-29. Secrets: `ENV_CI` (the whole `.env`, see
   `.env.ci.example`), `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`,
   `SERVER_PORT` — the same server values eaglestays uses. Optional
   `DEPLOY_PATH`.
2. **Configure `ENV_CI`.** Fill in every value marked required.
   `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` and `CRON_SECRET` should each be
   32+ random characters — compose refuses to start without them. Pick an
   `APP_PORT` nothing on the box uses (not 80/443/3000), and set
   `NEXT_PUBLIC_APP_URL` to `http://<server-ip>:<APP_PORT>` for now; it changes
   to the real domain at step 11.
3. **Deploy and confirm it is healthy, empty.** Push to the branch (or run the
   workflow by hand). It waits for the container healthcheck and fails the run
   if `app` is not healthy in five minutes. Then:
   ```bash
   cd /var/www/mrms
   $DOCKER compose ps            # app must read (healthy)
   curl -fsS http://127.0.0.1:<APP_PORT>/api/health
   ```
4. **Import a recent snapshot and test it.** Either restore a Postgres dump —
   ```bash
   DOCKER="$DOCKER" ./scripts/restore-db.sh mrms-dev-<stamp>.dump --force
   ```
   (the name must match one this project produces; the script dumps what is
   there first, stops the app, restores, and brings everything back up with
   migrations) — or dry-run the SQLite path from a Turso copy:
   ```bash
   $DOCKER compose run --rm --no-deps -v "$(pwd)/snapshot.db:/app/snapshot.db:ro" \
     migrate node scripts/pg/import.mjs snapshot.db --check
   ```
   Rehearsed on 2026-10-04 with these exact images and scripts, locally:
   restore in 11 seconds, app healthy, `prisma migrate status` clean, and
   `verify-business.ts` passing except one row count — eight outbound messages
   the dev scheduler wrote after the import, which is what a dev dump contains.

   Remember a restored dev dump carries real users and real client phone
   numbers. Leave WhatsApp/email unconfigured on this deployment until the
   window, or the scheduler's payment reminders will go to real clients.

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
   Run it on a workstation and copy `final.db` to `/var/www/mrms`, or inside the
   migrate image with `$DOCKER compose run --rm --no-deps -e TURSO_DATABASE_URL
   -e TURSO_AUTH_TOKEN -v "$(pwd):/out" migrate node scripts/pg/dump-turso.mjs
   /out/final.db`.

7. **Fingerprint the dump.** This is what the import is verified against, so it
   must come from the same file:
   ```bash
   node scripts/pg/baseline.mjs final.db --out docs/pg-migration/baseline.final.json
   node scripts/pg/drift-report.mjs final.db
   ```

8. **Validate before writing anything.**
   ```bash
   $DOCKER compose run --rm --no-deps -v "$(pwd)/final.db:/app/final.db:ro" \
     migrate node scripts/pg/import.mjs final.db --check
   ```
   Against the 2026-08-25 export this reports exactly one finding, the known
   `Job.invoiceNumber` policy (14 duplicated values, 16 surplus rows).
   **A new finding means stop and read it** — the resolvers in
   `docs/pg-migration/import-map.json` cover only what has been analysed.

9. **Import.**
   ```bash
   $DOCKER compose run --rm --no-deps -v "$(pwd)/final.db:/app/final.db:ro" \
     migrate node scripts/pg/import.mjs final.db --truncate --resolve-duplicates --resolve-orphans
   ```
   Both resolve flags are required and neither is a rubber stamp: the importer
   refuses to run unless every problem it found has a policy written down in
   `docs/pg-migration/import-map.json`, and it prints every row it changes. A
   problem with no policy is a decision the cutover has not made yet — read it,
   decide, record it there, and only then re-run. In particular `--resolve-orphans`
   will only null a foreign key whose relation declares `onDelete: SetNull` on a
   nullable column, so it can never quietly discard a link the datamodel treats
   as mandatory. The importer also derives `Invoice.paidAmount` from payments,
   so no separate backfill step follows.

   Every duplicate resolution is printed. **Keep that output** — it is the record
   of which rows were changed and why.

10. **Verify, twice, and do not skip this.**
    ```bash
    $DOCKER compose run --rm --no-deps -v "$(pwd)/docs:/app/docs:ro" \
      migrate node scripts/pg/verify-import.mjs docs/pg-migration/baseline.final.json
    $DOCKER compose run --rm --no-deps migrate bun scripts/pg/verify-business.ts
    ```
    The first compares row counts, the sum of every numeric column and the
    min/max of every timestamp. The second checks the result is usable:
    relationships resolve, enums are valid, money reads as numbers. Adjust the
    expected figures in `verify-business.ts` to the new dump's totals first, or
    read its failures as "these differ from July", which is expected.

    **Any unexplained discrepancy: stop.** Nothing has been switched over yet.

11. **Point traffic at the new stack.** On this server that needs a decision
    made before the window, because eaglestays owns 80/443:
    - **Add an MRMS server block to eaglestays' nginx** proxying the domain to
      `127.0.0.1:<APP_PORT>`, with its certificate. Smallest change; it lives in
      the eaglestays repository and ships with its deploy.
    - **Or merge eaglestays' `feat/traefik-edge`** first, then run MRMS with
      `docker-compose.shared-edge.yml`. Cleaner long-term, but it changes how
      the live eaglestays site is served, which is its own deploy and its own
      risk.

    Then set `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` in `ENV_CI` to the real
    domain, redeploy, switch DNS, and smoke-test by hand, not just by script:
    - log in
    - open a job, change its status, confirm the Messages tab shows the attempt
    - record a payment, confirm the receipt and the totals
    - generate an invoice PDF
    - search a client by lowercase name (this was a real regression — see the
      case-insensitivity fix)
    - `/api/admin/db-health` — must report `inSync: true`

    Then disable git deployments on the Vercel projects `mrms` and `mrms-apga`,
    and only after that merge the branch to `main` with `main` added to
    `deploy.yml`'s trigger.

12. **Confirm the scheduler is alive.** Four jobs stop silently if it is not:
    ```bash
    $DOCKER compose logs scheduler | tail
    ```

13. **Take a backup immediately** and copy it off the host:
    ```bash
    DOCKER="$DOCKER" ./scripts/backup-db.sh
    $DOCKER compose cp backup:/backups ./backups-local
    ```
    The script names the file `mrms-<utc>.dump`, which is the only shape
    `restore-db.sh` and Settings → Backups accept — a hand-named
    `post-cutover.dump` would be refused by the restore it exists for.

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

Before step 11 nothing has changed for users: lift the freeze on the old
deployment. `main` has not been merged, so Vercel is still serving the code it
was serving.

After step 11, rolling back means losing anything written to Postgres since the
switch. Repoint traffic at the old deployment, then reconcile by hand from the
audit log. This is the reason for the write freeze and for verifying at step 10
rather than after.
