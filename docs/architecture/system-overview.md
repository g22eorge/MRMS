# System Overview (Architecture Baseline — Gate 3, partial)

Date: 2026-09-23. Status: DRAFT from verified repo inspection. No code changed.

## Runtime
- Next.js 16.3.3 App Router, React 19 (`package.json`), `next.config.ts` (`distDir` honours `NEXT_DIST_DIR`).
- Bun runtime (`bun.lock`, `bunfig.toml`); scripts invoke `bun`/`bunx`.
- Deployment targets: Vercel (primary, `vercel.json` crons + `scripts/vercel-build.mjs`), Render (`render.yaml`), Docker (`Dockerfile`, `docker-compose.yml`).

## Data layer
- Prisma 6.19.3, `prisma/schema.prisma` provider `sqlite` (`file:./dev.db`).
- `prisma.config.ts` switches schema/migrations by dialect; `schema.postgresql.prisma` is GENERATED (do not edit).
- Prod runtime: Turso/libSQL via `TURSO_DATABASE_URL` + `lib/prisma.ts` (`PrismaLibSql`); build validation forces `file:./dev.db`.
- Migrations: 51 SQLite dirs in `prisma/migrations/`; PG has single `migrations-postgresql/0_init` baseline.
- Deploy discipline is split and must be respected: `db push` in dev/QA/seed scripts; `migrate deploy` only via `db:deploy` / `pg:deploy` / `RUN_PRISMA_MIGRATE_DEPLOY=1`; Vercel prod heals via reconciler scripts (`sync-schema-to-db`, `prod-job-column-safety`, `warranty-claim-foreign-keys`, `goods-received-item-drift`, `schema-shape-repair`, `job-quotation-number --apply`) before `next build`.

## Auth & tenant isolation (pattern IMPLEMENTED, exhaustive audit UNVERIFIED)
- `better-auth` + Prisma adapter (`lib/auth.ts`), 8h sessions, hardcoded trusted origins for care/app/Vercel + localhost.
- Entry: `proxy.ts` (Next 16; public paths + rate limits), `lib/org-context.ts:requireOrgSession` (care single-tenant pins `EIS_ORG_ID`, commercial requires `user.orgId`).
- Enforcement: `lib/permissions.ts` `can.*` matrix (denies `TECHNICIAN_EXTERNAL` broadly), `lib/org-write.ts:assertOrgCanMutate`, `lib/prisma-scope.ts` / `lib/db.ts` `scopedDb/orgDb`, `lib/org-scoped-models.ts`.
- Uploads validated (`lib/blob-storage.ts`: allowlist + 15MB + magic bytes + traversal guard in `app/api/upload/route.ts`).

## Module map (observed, not designed here)
- `app/(app)`: dashboard, intake, jobs (+new, [id], edit), finance (accounts/bank/expenses/journal/recurring/tax/reports), inventory (suppliers/PO/requests/GRN/bills/transfers/locations/counts), documents (invoices/quotations/receipts/delivery/credit/refunds/job-cards/templates), sales/pos/campaigns, clients, technicians, reports, settings (users/branches/billing/audit/data-heal/profile/groups/branding/ai/notifications), warranty, field, complaints.
- `app/(portal)`: customer portal (repairs/documents/complaints); `app/(platform)`: cross-org admin; `app/(auth)`, `(onboarding)`, `(legal)`, `(public)`.
- `app/api/` (86 routes): jobs, invoices, quotations, payments, credit-notes, refunds, delivery-notes, clients, sales, parts, procurement, reports, portal (5), billing callbacks, pesapal/whatsapp webhooks, cron (7: whatsapp-retry, subscription-lifecycle, data-heal, audit-prune, payment-reminders, payables, fx-rates), admin (16 incl. `db-fix`, `db-health`, `runtime-db`).
- `lib/` domains: `commercial/` (document-workflow, payment-sync, expense-payments, statements), `inventory-service.ts` + `inventory/`, `finance/`, `accounting/`, `jobs/`, `warranty/`, `communications/`, `notifications/`, `billing/`, `documents/`, `currency/`.
- Background: `bullmq` + `ioredis` + `lib/queue/worker.ts` alongside Vercel crons (overlap UNVERIFIED).

## Boundaries & invariants (must preserve)
- Server-side `orgId` + role checks at the action/API boundary; UI hiding is never authorization.
- `DocumentSequence(orgId,type,year,month)` numbering; receipt dedupe `@@unique([orgId,paymentId])`.
- Append-only audit (`AuditLog`, `SystemAuditEvent`, `UserAccessAudit`); never delete as cleanup.
- Money = Float + FX snapshots (see ADR-001); stock Lemma in ADR-003; tenant FKs in ADR-002.

## Known gaps pointing to later gates
- Requirements baseline missing (Gate 2) — do not invent; owner must approve scope/acceptance criteria.
- Integration gaps: `Quotation`↔`Sale` link, repair free-text parts, CRM auto-convert (see traceability matrix).
- Verification: E2E 29 tests exist; integration/failure/data-integrity coverage incomplete.
- Ops: no structured logger; backup/restore UNVERIFIED.

Next: Gate 2 REQUIREMENTS (owner input) or Gate 4 DESIGN review — not implementation.
