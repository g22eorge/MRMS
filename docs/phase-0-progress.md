# Phase 0 — Visible-bug triage: progress log

**Branch:** `phase-0-bug-triage` (from `main` @ 74a8271)
**Source plan:** [`system-analysis.md`](./system-analysis.md) → Consolidation roadmap → Phase 0
**Method:** one small task at a time; each fix is tested in the running app (localhost:3001) before the next starts; one commit per fix.

| # | Task | Status | Commit | Tested |
|---|------|--------|--------|--------|
| — | Branch + docs baseline | ✅ Done | 5853f7c | n/a |
| 0.1 | Fix `/platform-admin` crash (`undefined 'users'`) | ✅ Done | 77134cf | ✅ Browser |
| 0.2 | Real page titles: credit notes, delivery notes, POS | ✅ Done | e5988c4 | ✅ Browser |
| 0.3 | `notFound()` guard on `/jobs/[id]` | ✅ No fix needed | — | ✅ Browser |
| 0.4 | Dashboard outbox label: "5 failed · 38 dead" not "43 failed" | ✅ Done | 38d3b69 | ✅ Browser |
| 0.5 | Clients "new this month" KPI (77/77 import artifact) | ✅ Done | ec6c5bd | ✅ SQL |
| 1.1 | `lib/constants/payment-methods.ts` | ✅ Done | dc15632 | ✅ tsc |

---

## Log

### Setup — 2026-07-14

- Created branch `phase-0-bug-triage` from `main` (74a8271).
- Committed `docs/system-analysis.md` (new) and `docs/duplication-review.md` (now a pointer) as the baseline: 5853f7c.

<!-- Entries below are appended as each task completes: what changed, files touched, how it was tested, result. -->

### 0.1 — `/platform-admin` crash → redirect (77134cf)

**Root cause:** `platform-admin/page.tsx` mapped orgs to `{ userCount, jobCount }` but passed them to the shared `OrgTable`, which reads `org._count.users` / `org._count.jobs` (`platform/OrgTable.tsx:159`). `_count` was undefined → "Cannot read properties of undefined (reading 'users')". Textbook drift between the duplicated `/platform` and `/platform-admin` trees (system-analysis.md UX-2 / finding 16).

**Change:** replaced both `platform-admin` pages with redirects instead of patching the dead copy:
- `app/(platform)/platform-admin/page.tsx` → `redirect("/platform")`
- `app/(platform)/platform-admin/orgs/[id]/page.tsx` → `redirect(\`/platform/orgs/${id}\`)`

Checked nothing routes *to* `/platform-admin` (only a harmless `revalidatePath` in `platform/actions.ts:131`). Full consolidation stays in Phase 3.5.

**Test:** browser → `http://localhost:3001/platform-admin` now lands on `/platform`, Organisations page renders (1 org, KPI row, table). ✅

### 0.2 — Missing page titles (e5988c4)

**Root cause:** `pageMeta()` in `components/layout/PageThemeHeader.tsx` had no entries for `/documents/credit-notes`, `/documents/refunds`, `/documents/delivery-notes`, `/pos`, `/pos/[id]` — all fell through to the generic `{ title: "Workspace" }` fallback (line 58).

**Change:** added five title+description entries matching the tone of existing ones (refunds and `/pos/[id]` added as obvious siblings of the observed three).

**Test:** browser → header zooms confirm "Credit Notes — Sales returns, adjustments…", "Delivery Notes — Delivery and handover proof…", "Point of Sale — Walk-in and retail sales transactions." ✅

### 0.3 — `/jobs/[id]` not-found guard — no fix needed

**Retest result:** `jobs/[id]/page.tsx` already calls `notFound()` (lines 61, 119) and `/jobs/board` renders a proper "We could not find that record" card with Go-to-jobs / Dashboard actions after compile. The original "endless skeleton" observation was dev-server first-compile latency. `system-analysis.md` UX-7 downgraded accordingly. Remaining cosmetic nit (header shows "Ref board" above the 404 card) logged there — not Phase 0 material.

### 0.4 — Dashboard outbox label split (38d3b69)

**Root cause:** `dashboard/page.tsx:1061` counted `status IN (FAILED, DEAD)` as one number and labelled all 43 "messages failed", while the Outbox page shows Failed · 5 and Dead · 38 as separate tabs — users clicking "Fix" couldn't find "43" anywhere.

**Change (`app/(app)/dashboard/page.tsx`):**
- Replaced the single `count()` with a `groupBy(["status"])` over FAILED/DEAD.
- Derived `failedMsgCount`, `deadMsgCount`, total `failedOutboxCount` (existing conditions/colours untouched) and a `failedOutboxLabel` ("5 failed · 38 dead", degrading gracefully when either is 0).
- Updated both labels: Needs-action alert row and Communications card health strip.

**Test:** browser → dashboard Needs-action row and Communications card both read "**5 failed · 38 dead** messages", matching the Outbox tabs. ✅

### 0.5 — Clients "New This Month" KPI

**Root cause:** KPI counted `createdAt >= monthStart` only, so bulk-imported clients looked "new" when import stamped `createdAt` to the current month. Subtitle `+{n} this month` duplicated the headline number (77/77 on the walkthrough dataset).

**Change (`app/(app)/clients/page.tsx`):**
- Count clients created this month **and** with no jobs `receivedAt` before month start.
- Subtitle → "first seen this month".

**Test:** SQL on `mrms-prod.db` — total 77, new KPI 8 (July 2026), guard excludes import-with-history edge case. ✅

**Doc:** [`fixes/phase-0-0.5-clients-new-this-month-kpi.md`](./fixes/phase-0-0.5-clients-new-this-month-kpi.md)
