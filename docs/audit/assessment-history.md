# Assessment History

## 2026-09-23 — SDLC Baseline (formal)
- Scope: repo structure, architecture, DB, workflows, tests, security, ops. No code changed.
- Evidence: 130 `page.tsx`, 86 `route.ts` under `app/api`, 119 Prisma models / 59 enums, 51 SQLite migrations + PG baseline, 92 unit tests, 10 E2E specs / 29 tests.
- Prior claims rechecked: 127→130 pages, 71→86 APIs, 115→119 models. Direction of prior assessment confirmed (retail closer than repair; repair-parts gap real).
- Outputs: `docs/audit/findings.md`, `docs/audit/issue-register.md`, `docs/audit/traceability-matrix.md`, `docs/decisions/ADR-001..003` (all PROPOSED).
- Gate verdict: DISCOVERY/REQUIREMENTS NOT READY; ARCHITECTURE/IMPLEMENTATION/INTEGRATION PARTIAL; VERIFICATION NOT READY; RELEASE NOT READY.

## 2026-09-23 — Architecture Baseline (Gate 3, partial)
- Added `docs/architecture/system-overview.md` (DRAFT, evidence-backed). No code changed.
- Gates 1–2 still need owner-approved scope/requirements before any implementation.

## 2026-09-23 — P2-02 resolved (upload-limit drift)
- Finding: test + checklist mirrored stale 5MB/3-type rule; code is deliberately 15MB/5-type (phone photos, HEIC→JPEG).
- Change: new `lib/upload-limits.ts` (ALLOWED_TYPES, MAX_BYTES, LOGO_MAX_BYTES, hasValidImageSignature, isHeicType); `lib/blob-storage.ts` imports + re-exports (behaviour identical); `tests/unit/09-upload-security.test.ts` imports real logic; checklist corrected.
- Verification: `bun test 09-upload-security + blob-storage-routing` 21 pass; `tsc --noEmit` clean; `eslint` on touched files clean.

## 2026-09-23 — Verification gate (unit, full)
- `bun run test:unit`: **1100 pass, 4 skip, 0 fail across 92 files** (isolated runner, test DB reprovisioned). Includes rewritten `09-upload-security` (real 15MB/5-type limits).

## 2026-09-23 — QA evidence gates (read-only)
- `bun run qa:data-integrity` (dev.db, 33 jobs): PASS — audit coverage, completed-job billing, client counts, no orphaned jobs.
- `bun run qa:http-security`: PASS — unauthenticated API/page access redirected (307) across jobs, reports export, clients.

## 2026-09-23 — QA evidence gates, continued (script-reported)
- `bun run qa:concurrency`: PASS — concurrent job updates + audit writes sane (writes one marked `technicianNotes` + audit rows on dev.db by design).
- `bun run qa:perf`: PASS — /login avg 5.9ms p95 8.4ms (<900ms); /jobs + /api/jobs unauth avg <1ms (<250ms). Note: unauth paths return redirects, so this is a smoke check, not a loaded-page benchmark.

## 2026-09-23 — QA evidence gates, continued II (script-reported)
- `bun run qa:pdf-smoke`: PASS — invoice, quotation, job card, sale receipt, payment receipt all valid PDFs (delivery-note skipped: none in DB).
- `bun run qa:rate-limit`: PASS — 10×401 then 429 on sign-in endpoint; limiting active.

## 2026-09-23 — Predeploy gate (script-reported)
- `bun run predeploy:check`: PASS — typecheck, lint, audit, production build, QA subset re-run green. E2E skipped inside (`REQUIRE_E2E` unset); covered separately by 29/29 E2E run.

## 2026-09-23 — ADRs approved; ADR-003 UI distinction implemented
- Owner approved ADR-001/002/003. Register updated (P1-01 IN PROGRESS, P1-02/03 OPEN).
- `components/jobs/JobDetailTabs.tsx`: `partsNeeded` + `partsReplaced` now labelled "(notes only)" with hints that only the parts panel moves inventory (ADR-003 Option 2).
- Verification: `tsc` clean, `eslint` 0 errors. No behaviour change (display text only).

## 2026-09-23 — ADR-001 tests (helper verified, sums follow-up open)
- `roundMoney`/`toBaseAmount` already existed in `lib/currency.ts` and are used across document-workflow, VAT, invoicing, POS — no new helper needed.
- Added `tests/unit/money-rounding.test.ts` (8 tests): decimals, UGX/USD rounding, 0.1+0.2 trap, non-finite→0, FX netting (two- and three-way splits net once rounded).
- Evidence: raw FX sums must never face `===` (same expression exact under FMA, off-by-ulp elsewhere — found live between Bun/V8). `payment-sync.ts` compares raw sums today → follow-up recorded on P1-02.
- Verification: file 8/8 pass; `tsc` clean; `eslint` clean.

## 2026-09-23 — ADR-001 follow-up implemented (P1-02 resolved)
- `lib/commercial/payment-sync.ts`: `toDocumentBase` all returns + `sumInvoicePaidAmount` / `sumSalePaidAmount` now return `roundMoney(..., baseCurrency)`. Paid/total comparisons meet on rounded values; stored `paidAmount` is rounded.
- Verification: `tsc` clean, `eslint` clean, full `bun run test:unit` **1108 pass, 4 skip, 0 fail across 93 files**.

## 2026-09-23 — ADR-003 E2E (P1-01 resolved)
- New `tests/e2e/repair-parts.spec.ts`: own `e2e-repair-parts` org, part + location fixture; UI reserves 2 (RESERVED, qtyReserved 2) then marks fitted (CONSUMED, qtyOnHand/location 10→8, ledger row); diagnosis + repair boxes assert notes-only labels; free-text columns stay null.
- Verification: spec 1/1 pass; `tsc` + `eslint` clean. Follows `document-lifecycle` fixture/cleanup pattern.

## 2026-09-23 — ADR-002 FK migration (P1-03 resolved)
- 4 models (`Receipt`, `InvoiceLine`, `PaymentAllocation`, `PartLocationStock`) + `Organization` back-fields; Cascade per Invoice/Payment precedent; PG variant regenerated.
- Found 9 orphan location-stock rows (deleted E2E orgs) blocking FKs — deleted after backup; dev.db/prisma/test.db had zero orphans.
- Learned: every local path resolves to `prisma/dev.db` (`lib/prisma.ts`, `prisma.config.ts`); repo-root `dev.db` is stale, untouched. `migrate dev` needs reset from pre-existing push-drift — not acted on.
- Verification: push OK, fresh test.db carries FKs, `test:unit` 1108/0 fail, drift-check OK, `tsc` clean, repair-parts E2E 1/1.

## 2026-09-23 — Full E2E re-validation after all P1 changes
- `bun run qa:e2e` (with `NEXT_DIST_DIR=.next` per known config quirk): **30 passed, 0 failed (3.7m)** across 11 files, incl. new `repair-parts` spec.
