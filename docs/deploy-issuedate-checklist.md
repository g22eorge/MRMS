# Deploy checklist — add `issueDate` to production (Quotation)

Commit `e678240` added an `issueDate` column to the `Quotation` model. The
production Turso database does **not** get columns from a code deploy, so this
column must be added by running the platform **DB Fix** once after deploy.

Until it is run, quotation pages error with:
`SQLite input error: no such column: main.Quotation.issueDate`

The DB Fix endpoint is **platform-admin only**, **idempotent**, and
**self-retrying** — it only adds missing columns and never drops data, so it is
safe to run and re-run.

---

## 0. Prerequisites

- [ ] The deploy has finished and the new build (>= `e678240`) is serving.
- [ ] `PLATFORM_ADMIN_EMAIL` is set in the production environment. (It fails
      closed: if unset, nobody is a platform admin.)
- [ ] You are signed in as that exact email, with role ADMIN.

## 1. Run the DB Fix (browser)

- [ ] Open `https://<your-app-domain>/api/admin/db-fix`
      (for example `https://app.eagleinfosolutions.com/api/admin/db-fix`).
- [ ] You get the DB Fix runner page — click **Run**.
- [ ] Let it finish. It auto-retries (up to 8 times) because it is idempotent;
      any schema changes already applied are kept.
- [ ] Success is a result showing `ok: true` and an `applied` list of changes.

## 2. Verify

- [ ] Open **Documents -> Quotations** and click into any quotation — it loads
      with no `issueDate` error.
- [ ] Open a **draft** quote -> **Edit** -> confirm the **Issue date** field
      appears and **Save** works.
- [ ] (Optional) Create a new quotation and confirm the issue date persists.

## 3. If something looks off

- [ ] Re-run it — idempotent, so a second run only adds what is still missing.
- [ ] `403 Forbidden` -> you are not the `PLATFORM_ADMIN_EMAIL` user, or your
      role is not ADMIN. Fix that and retry.
- [ ] Still erroring on `issueDate` after a successful run -> confirm the deploy
      actually shipped commit `e678240` (the one that teaches DB Fix to add the
      column).

---

## Notes

- No data is destroyed. The only relevant change is:
  `ALTER TABLE "Quotation" ADD COLUMN "issueDate" DATETIME`.
- Existing quotations get a NULL `issueDate` and fall back to their created
  date in the UI and PDF.
- Nothing to roll back: if the code is ever reverted, the extra column is
  harmless and simply unused.
- Related runbooks: `docs/prod-db-hotfix-runbook.md`,
  `docs/production-readiness-checklist.md`.
