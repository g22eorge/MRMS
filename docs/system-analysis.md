# MRMS System Analysis — Code & User Experience

**Purpose:** Combined engineering + UX review for a more optimised SaaS platform. Merges the code duplication audit with a live UI walkthrough of `http://localhost:3001` (admin session, July 2026 data), so every refactor is tied to a user-visible symptom where one exists.

**Scope:** Full codebase scan (`lib/`, `app/`, `components/`, `app/api/`) + walkthrough of Dashboard, Jobs, Documents (all 6), Clients, POS, Inventory, Reports, AI Insights, Outbox, Settings, Platform admin.
**Date:** 2026-07-14
**Status:** Review draft — no refactors applied.

---

## Executive summary

The platform is feature-rich and the dashboard/inventory surfaces are strong. The dominant systemic problem is **the same logic implemented multiple times drifting apart**, and the walkthrough shows this drift is already user-visible: the same month's revenue reads **UGX 6.3M on the Dashboard, UGX 0 on Reports, and UGX 0 in AI Insights**; currency renders as **UGX** in-app but **USh** on platform pages; dates render **M/D/YYYY** on invoices/receipts but **DD/MM/YYYY** on jobs/quotations. One duplicated route (`/platform-admin`) crashes outright.

| Priority | Finding | Type | User-visible today? |
|----------|---------|------|---------------------|
| P0 | KPI contradiction: Dashboard vs Reports vs AI Insights | Code + UX | **Yes** — 6.3M vs 0 vs 0 for 2026-07 |
| P0 | Dual Prisma org scopers (`scopedDb` vs `orgDb`) | Code | Latent — tenant isolation risk |
| P0 | Payment / paid-status sync duplicated in 5+ flows | Code | Latent — invoice/job paid mismatch |
| P1 | `/platform-admin` runtime crash (`undefined 'users'`) + parallel platform routes | Code + UX | **Yes** — page is broken |
| P1 | Currency label drift (UGX vs USh) + local `fmtMoney` copies | Code + UX | **Yes** |
| P1 | Date format drift (M/D vs DD/MM) across document pages | Code + UX | **Yes** |
| P1 | Job PDF routes duplicate `lib/pdf/generate-*` | Code | Latent — download vs WhatsApp drift |
| P1 | Document share actions duplicated (4 pages) | Code | Latent — wrong-recipient risk |
| P1 | 6 document list pages: duplicated structure + inconsistent filters/headers | Code + UX | **Yes** |
| P2 | Outbox terminology mismatch ("43 failed" = 5 failed + 38 dead) | UX | **Yes** |
| P2 | `/jobs/board` swallowed by `/jobs/[id]` → endless skeleton | UX | **Yes** |
| P2 | Phone display inconsistency (`07…` vs `+256…`) + 3 normalizer variants | Code + UX | **Yes** |
| P2 | Line-item forms, auth gates, AI metrics pack | Code | Latent |
| P3 | Modals, payment constants, settings dupes, doc numbering, Zod schemas | Code | Latent |

**Quick wins:** ~800–1,200 LOC removable at low risk (payment constants, modals, PDF route helpers, share helper, dead code) **plus** three one-line-class UX fixes (page titles, outbox label, board route).

---

## Part 1 — UX walkthrough findings

### UX-1. One month, three different revenue numbers (P0)

Observed for **2026-07** in the same session:

| Surface | Shows |
|---------|-------|
| Dashboard | Revenue "Total this month **UGX 6.3M**" (Repairs 2.6M + Products 3.7M), Gross margin 6.3M |
| Reports → Executive Overview | Revenue **UGX 0**, Net profit **UGX 0**, Jobs completed **0** this period |
| AI Insights | Total revenue signal **UGX 0** (0.0% vs previous month) |

**Root cause (verified in code):** each surface defines its own `monthRange` (`dashboard/page.tsx:42`, `reports/page.tsx:35`, `ai-insights/page.tsx:26`, `api/ai-business-copilot/route.ts:47` — two incompatible signatures) **and** its own revenue definition: the dashboard sums payments received in the month, while reports sum billed value of jobs *completed* in the period (`completedSelected` in `reports/page.tsx:394`). Neither is wrong alone; together they read as broken finance data and undermine trust in the AI copilot ("no invented numbers" claim next to a zero that contradicts the dashboard).

**Fix:** single `lib/ai/business-metrics.ts` + `lib/date-ranges.ts` consumed by all four surfaces (merges code findings 8 & 12). If two definitions must coexist (cash-received vs completed-value), label them explicitly in the UI.

### UX-2. `/platform-admin` crashes (P1)

Navigating to `/platform-admin` renders: `Platform error — Cannot read properties of undefined (reading 'users')`. Its sibling `/platform` works and shows the same data. Direct evidence for consolidating the parallel platform route trees (code finding 16) — the duplicated copy has already drifted into a broken state.

### UX-3. Currency label drift: UGX vs USh (P1)

`/platform` renders "**USh 0**" while the entire app renders "**UGX**". Cause: 5 platform pages define a local `fmtMoney` instead of importing `formatMoney` from `lib/currency.ts` (code finding 11). Same-tenant admin and app views disagree on how to write the org's own currency.

### UX-4. Date format drift across pages (P1)

- Invoices & receipts: `7/9/2026` (M/D/YYYY, US-style)
- Jobs table & quotations: `07/07/2026`, `25/06/2026` (DD/MM/YYYY)
- Platform: `23 May 2026`

For a Ugandan audience, `7/9/2026` reads as 7th September. This is the live symptom of the date-formatting sprawl (code finding 12) — inline `toLocaleDateString` calls with no shared locale/timezone policy.

### UX-5. Six document pages, three filter paradigms, two header styles (P1)

Observed across `/documents/*`:

| Page | Header title | Period filter UI |
|------|-------------|------------------|
| Invoices | "Invoices — Issue, collect…" | Dropdowns + "Filter" button |
| Receipts | "Receipts — Track payments…" | Pills fused to search: All Time / This Month / Last Month / Last 30 Days |
| Quotations | "Quotations — Prepare…" | Chips: All time / This month / Last month + dropdown + Filter |
| Credit notes | generic "**Workspace**" | Chips + segmented All / Awaiting Return / Items Received |
| Delivery notes | generic "**Workspace**" | Chips + method pills + "Search" button |
| POS | generic "**Workspace**" | — |

Same duplication cluster as code finding 6 (5,353 LOC): each page reimplemented the header/KPI/filter shell and they have drifted. The `DocumentPageHeader` / `PeriodFilterChips` / `DocumentDataView` kit fixes look and behaviour together. The missing page titles on credit notes, delivery notes and POS are a one-line fix each in the meantime.

### UX-6. Outbox: numbers don't match the dashboard's promise (P2)

Dashboard Communications card: "**43 messages failed** — Fix". Outbox shows **Failed · 5** and **Dead · 38** (43 = 5 + 38, silently combined). A user clicking "Fix" lands on counts that don't visibly contain "43". Also: the outbox lives at `/settings/notifications/outbox` (a typed `/outbox` 404s) — deep nesting for an operational queue promoted on the dashboard. Align the label ("5 failed · 38 dead") or the outbox summary, and consider a top-level route/redirect.

### UX-7. `/jobs/board` renders as a job called "board" (P2)

`/jobs/board` is captured by the `/jobs/[id]` dynamic route: header shows "Job Details — Ref board" with skeleton loaders that never resolve. Two issues: the board view toggle is not a real route (or the route order is wrong), and an invalid job ref shows an infinite skeleton instead of a not-found state. Add a `notFound()` guard on unresolved refs.

### UX-8. Client phone display inconsistency (P2)

Clients table mixes `0774006655` and `+256776193606` in the same column. Live counterpart of code finding 10 (three phone normalizer variants). Normalize on save and format consistently on display via one `lib/phone.ts`.

### UX-9. Smaller observations (P3)

- **Duplicate create entry points:** Invoices page has "+ New Invoice" (header) and a second "+ Create Invoice" collapsible row directly below the search bar.
- **Misleading KPI:** Clients shows "New this month **77** (+77 this month)" — equal to total clients; `joinedAt` was presumably set at import. Reads as broken analytics.
- **Icon-only row actions:** Receipts rows have three unlabeled icon buttons; invoices' Actions column renders bare "–" buttons. Add tooltips/labels (also solved by the shared `RowActionsMenu` in the document kit).
- **Inline destructive action:** POS list exposes a red "Delete" directly on an open sale row while other rows don't — verify confirm flow and gate consistency.
- **Compact-money mixing:** POS mixes `UGX 29.5K` and `UGX 4.1M` in one column with full amounts elsewhere; pick per-context rules in `lib/currency.ts` (`formatMoney` vs `formatMoneyCompact`).

**What already works well (keep):** dashboard information architecture (Needs-action, Quick actions, Technicians leaderboard), Inventory Control Desk (exception queue + operations rail), outbox retry/attempt visibility, AI copilot's "Aggregate only / no client PII" framing, invoices aging buckets + Collect Revenue prompt.

---

## Part 2 — Code duplication review

### P0 — Security & data correctness

#### 1. Dual Prisma org-scoping systems

Consolidate on one tenant-scoped Prisma client; deprecate the other.

| Module | Path | Role |
|--------|------|------|
| `scopedDb` | `lib/prisma-scope.ts` | `$extends` auto `orgId` + soft-delete filter (~60 models) |
| `orgDb` | `lib/prisma.ts` | `$extends` auto `orgId` on writes (~30 models) |
| `orgWhere` | `lib/org-context.ts` | Manual `{ orgId }` helper |

Evidence: `scopedDb` documents itself as mandatory yet has **zero production imports**; `orgDb` is used in 20+ pages/routes; `orgWhere` is never imported; the two model lists differ, so soft-delete filtering behaviour depends on which helper a contributor happens to pick.

Merge: pick `orgDb` (current usage) or finish the `scopedDb` migration (stronger safety); unify model lists; single `lib/db.ts` entry point; delete dead helpers. **Risk: High** — wrong merge breaks tenant isolation; audit all direct `prisma.*` usage first.

#### 2. Payment / paid-status synchronization

Extract `lib/commercial/payment-sync.ts` (`syncInvoicePaymentState()`, `syncSalePaymentState()`).

Duplicated in: `documents/receipts/page.tsx`, `documents/invoices/page.tsx`, `jobs/[id]/actions.ts`, `payout-followups/page.tsx`, `pos/[id]/page.tsx`. Each copy: sum payments → compare to total → update `invoice.status/paidAt/paidAmount` → update `job.clientPaid/clientPaidAt`. AGENTS.md flags payments/refunds as high-risk. **Risk: High** — invoice PAID in one UI, job unpaid in another.

Related dead code: `writePaymentAccountingDocuments()` in `lib/commercial/accounting.ts` is never called (canonical path is `createReceiptForPayment()` in `document-workflow.ts`) — remove to prevent future duplicate receipts.

### P1 — Customer-facing & operational consistency

#### 3. Job PDF routes duplicate `lib/pdf/*` generators

`app/api/jobs/[id]/{quotation,invoice,job-card}/route.ts` each locally redefine `prettyEnum`, `compactText`, `compactListText` (already in `lib/pdf/pdf-utils.ts`), `formatDocDate` (duplicates `formatEATDocDate` in `lib/date-eat.ts`) and logo resolution. The WhatsApp send path already uses `generate*Buffer()` — so the **downloaded PDF and the WhatsApp PDF come from different code**. Refactor routes onto the buffer helpers (~270 lines saved). **Risk: High** for customer-facing PDFs — verify with `bun run qa:pdf-smoke`.

#### 4. Document share server actions (near-identical ×4)

`receipts`, `credit-notes`, `refunds`, `delivery-notes` pages each define inline `"use server"` `share*WhatsAppAction`/`share*EmailAction` with the same shape: session+role gate → load entity by `id`+`orgId` → resolve recipient from `invoice?.job?.client ?? invoice?.client ?? sale?.client` → build PDF URL → enqueue. Recipient resolution is privacy-sensitive; drift risks messaging the wrong client. Extract `lib/notifications/share-document.ts`. **Risk: Medium.**

#### 5. WhatsApp PDF send bypasses the outbox helper

`sendPdfViaWhatsApp` manually creates the `outboundMessage` row and calls the Meta API directly, while `sendManualReplyAction` uses the canonical `enqueueWhatsAppMessage` → `deliverOutboundMessage` path. Route it through the outbox (or a new `enqueueWhatsAppDocument`) so status/retry/`lastError` behave uniformly — this is also what makes the Outbox numbers (UX-6) trustworthy. **Risk: Medium–High.**

#### 6. Document list pages — structural duplication (5,353 LOC)

| Page | Lines |
|------|------:|
| invoices | 1,698 |
| quotations | 922 |
| refunds | 775 |
| receipts | 712 |
| credit-notes | 658 |
| delivery-notes | 588 |

All repeat: header block, 4-tile KPI strip, period chips, search/filter form, desktop table + mobile cards, `RowActionsMenu` (duplicated per breakpoint). The walkthrough (UX-5) shows the visible cost: three filter paradigms, missing titles, unlabeled actions. Extract `components/documents/` kit: `DocumentPageHeader`, `DocumentKpiStrip`, `PeriodFilterChips`, `DocumentShareActions`, `DocumentDataView`. **Risk: Medium** — invoices has unique aging/collect-revenue logic; migrate incrementally starting with receipts + delivery-notes.

### P2 — Forms, metrics, auth, phones

#### 7. Commercial line-item forms (×6)

`CreateStandaloneInvoiceForm`, `NewQuotationForm`, `NewPurchaseOrderForm`, `NewPurchaseRequestForm`, `NewSupplierBillForm`, `NewStockCountForm` share the `nextId`/`keyCounter`/`JSON.stringify(lines)` pattern and option types. Extract presentational `LineItemsEditor`, `CustomerPicker`, `useLineItemsState`; keep server actions per domain. **Risk: Medium** — domain rules differ.

#### 8. AI business metrics pack duplicated

`ai-insights/page.tsx` and `api/ai-business-copilot/route.ts` duplicate `monthRange` + KPI queries (~160 lines). Now confirmed user-visible as UX-1. Extract `lib/ai/business-metrics.ts` with one `buildBusinessDataPack(orgId)`; normalize `monthRange` signatures (`(year, month)` in dashboard/reports vs `(Date)` in AI) into `lib/date-ranges.ts`. **Risk: Medium → elevated by UX-1.**

#### 9. Auth / platform-admin check divergence

`isPlatformAdminEmail()` (`lib/session.ts`, email-only), `checkIsPlatformAdmin()` (email-only) and `checkPlatformAdmin()` (email **and** `role === "ADMIN"`) coexist; login routes re-read `PLATFORM_ADMIN_EMAIL` directly. Route all gates through `lib/platform-admin.ts`. Note the broken `/platform-admin` page (UX-2) sits behind these gates — fix crash and gate divergence together. **Risk: Medium.**

#### 10. Phone normalization (3 variants)

`lib/notifications/sms.ts` (E.164 `+256…`), `lib/notifications/whatsapp.ts` (digits `256…`), `app/api/webhooks/whatsapp/route.ts` (mirror copy). Extract `lib/phone.ts` with `normalizeUgPhone(input, { format })` and use it for display too (UX-8). **Risk: Medium** for delivery + webhook contact matching.

### P3 — DRY / maintainability

11. **Currency formatting sprawl** — 5 platform pages + several components define local `fmtMoney` instead of `lib/currency.ts` `formatMoney`; copilot rounds with `Math.round`. Now user-visible as UX-3 (USh vs UGX). Low effort, do first.
12. **Date/time formatting sprawl** — inline duplicates in outbox, users, audit pages, `JobDetailTabs`; incompatible `monthRange` signatures. User-visible as UX-4. Extend `lib/date-eat.ts`, add `lib/date-ranges.ts`, and define one locale policy (recommend `en-GB`/EAT → DD/MM/YYYY).
13. **Payment method constant ×5** — identical `["CASH","MOBILE_MONEY","BANK_TRANSFER","CARD","OTHER"]` in 5 pages. Extract `lib/constants/payment-methods.ts` + `PaymentFields`. Safest first refactor.
14. **Modal shells ×4** — `CreateReceiptDialog`, `CreateCreditNoteDialog`, `SetTargetDialog`, `ConfirmDialog` hand-roll the same overlay/Escape/panel pattern. Extract `components/ui/Modal.tsx`; test keyboard/a11y.
15. **Settings duplication** — password/profile duplicated ~80 lines between `ProfileForm` and `SettingsPanel`; `SettingsPageHeader` defined but never imported (use or delete).
16. **Platform admin parallel routes** — `/platform` and `/platform-admin` duplicate revenue queries, `fmtMoney`, and org detail pages; the copy has already broken (UX-2). Consolidate to one tree.
17. **Inventory action auth guards ×7** — identical `requireOrgSession → permission → assertOrgCanMutate → redirect` in 7 `actions.ts` files. Extract `lib/inventory/auth.ts`.
18. **Document numbering** — canonical max-sequence in `document-workflow.ts` vs ad-hoc count+1 in `stock-counts` (`SC-`) and `purchase-orders` (`GRN-`); count-based collides under concurrency. Extend `nextDocumentNumber()`.
19. **Zod client/lead schemas repeated** — client identity rules duplicated in 4 files; `quotation-service.ts` uses manual length checks. Extract `lib/schemas/{client,lead,device}.ts`.
20. **Finance PDF routes (EagleInfo cluster)** — `credit-notes/[id]`, `refunds/[id]`, `quotations/[id]` ~80% identical; extract `renderPdfResponse()` + prop builder. Receipt paths intentionally split (different templates).

### Intentional duplication (do not merge blindly)

| Item | Reason to keep separate |
|------|-------------------------|
| Multiple PDF React templates (`lib/pdf/*`) | Tier/branding feature via `lib/pdf/templates.ts` |
| Admin vs cron API routes | Different auth (platform admin vs `CRON_SECRET`) over shared libs |
| Procurement HTML print route | Different stack from react-pdf |
| `JobBoardView` vs `JobTable` | Different UX, not duplicate implementations |
| Sales vs job quotation entities | Different data models; merge rendering, not entities |

---

## Part 3 — UX flow optimisation (best-experience recommendations)

Beyond fixing inconsistencies, these change how work *flows* through the product. Based on the observed screens and data (75 jobs, 8 uninvoiced completed repairs, 43 stuck messages, 5 quotes awaiting client).

### FLOW-1. Close the job → invoice → payment loop (highest impact)

The money loop currently requires page-hopping: complete a job on **Jobs**, then go to **Documents → Invoices** to find the "Collect Revenue — 8 repairs completed but not yet invoiced" prompt, then record payment, then (separately) a receipt exists under **Receipts**. The dashboard itself shows the leak: "3 completed unpaid", 8 jobs ready-to-invoice worth UGX 1.2M sitting 68–92 days.

Recommended flow: when a job transitions to **Completed**, show one modal: *Invoice now → send via WhatsApp → record payment when it arrives* — a single guided sequence using the shared payment-sync and share helpers from Part 2. The 92-day-old uninvoiced repair should be impossible, not a dashboard statistic.

### FLOW-2. Make collections a workflow, not a report

Invoices page already has aging buckets and an overdue callout (INV-…/0009, 42d overdue) but no action attached. Add a one-click **"Send reminder"** (WhatsApp/email via the outbox) on every overdue row, and a "remind all in bucket" bulk action. Pair with the payout-followups pattern that already exists for techs.

### FLOW-3. Promote Communications out of Settings

The dashboard treats messaging as first-class (Communications card, "43 messages failed — Fix"), but the destination is buried at **Settings → Notifications → Outbox**, and `/outbox` 404s. Give Communications a top-level sidebar entry (Outbox, Templates, WhatsApp, Policies). Failed messages are operational work, not configuration.

### FLOW-4. Unify Documents into one hub

Six sibling pages, six shells (Part 2 #6). For the user, quotation → invoice → receipt → delivery note is **one document lifecycle per job/sale**, not six unrelated lists. Recommended: a single **Documents** hub with tabs (the shared kit makes this nearly free), plus a per-job "Documents" timeline on the job detail page so staff never hunt across lists for one client's paperwork.

### FLOW-5. Global command surface

Every page has its own search box with a different placeholder ("invoice, job, client…", "reference, invoice #, sale #…", "name, phone, email…"). Add one global search / command palette (⌘K): jump to job by ref, client by phone, invoice by number, and trigger quick actions (New Job, Record Payment) from anywhere. The dashboard's Quick Actions grid shows the six verbs that matter — make them available globally.

### FLOW-6. State contract for every list/detail page

Observed: infinite skeleton on an invalid job ref, silent empty tables, a crashed platform page. Define one contract for all pages: **loading (skeleton) → content | empty (with CTA, like Bank accounts' "Add account →") | not-found (404) | error (retry)**. The good empty states already in the app (credit notes, delivery notes) show the pattern to standardise.

### FLOW-7. Progressive disclosure on dense pages

Invoices (1,698 LOC) stacks KPI strip + aging buckets + overdue callout + collect-revenue queue + filters + duplicate create CTA + table on one screen. Keep the page focused on *the list*; move "Collect Revenue" into the Needs-action framing (dashboard already does this well) and collapse secondary KPIs. One "+ New Invoice" entry point, not two.

### FLOW-8. Guided quote follow-up

Quotations shows "5 awaiting client — need decision" as a badge only. Add a follow-up action per awaiting quote (WhatsApp nudge with the quote PDF link, using the shared share helper) and an expiry policy so stale drafts (6 DRAFTs dating to June) age out or escalate instead of accumulating.

---

## Consolidation roadmap (code + UX together)

### Phase 0 — Visible-bug triage (hours, ship immediately)

1. Fix `/platform-admin` crash (or redirect to `/platform` pending consolidation)
2. Add real page titles to credit notes, delivery notes, POS (replace "Workspace")
3. Guard `/jobs/[id]` with `notFound()` for unresolved refs; give the board view a real route
4. Dashboard outbox label: "5 failed · 38 dead" (or merge statuses in outbox UI)
5. Clients "new this month" KPI: exclude imported records or drop the tile until correct

### Phase 1 — Safe, high ROI (1–2 days)

1. `lib/constants/payment-methods.ts` + `PaymentFields`
2. Platform pages → `formatMoney` from `lib/currency.ts` (kills USh/UGX drift)
3. `lib/date-ranges.ts` + one date display policy (kills M/D vs DD/MM drift)
4. Job PDF routes → `generate*Buffer` + `pdf-utils` imports
5. Remove dead `writePaymentAccountingDocuments`, `orgWhere`, `SettingsPageHeader`; dedupe `ProfileForm`

### Phase 2 — Data correctness & trust (3–5 days)

1. `lib/ai/business-metrics.ts` — one metrics pack for Dashboard, Reports, AI Insights, Copilot; label cash-received vs completed-value explicitly (resolves UX-1)
2. `lib/commercial/payment-sync.ts` — unify all payment entry points
3. `lib/notifications/share-document.ts` — unify document share actions
4. `lib/phone.ts` — normalize SMS/WhatsApp/webhook + display
5. Route `sendPdfViaWhatsApp` through the outbox helper

### Phase 3 — Structural (1–2 weeks)

1. Prisma scoper consolidation (`orgDb` vs `scopedDb`) with tenant isolation QA
2. `components/documents/` kit; migrate receipts + delivery-notes first, invoices last (standardises filters, headers, row actions across all 6 pages)
3. Line-item form primitives
4. `components/ui/Modal.tsx`
5. Consolidate `/platform` + `/platform-admin`; extract inline `"use server"` blocks

### Phase 4 — Flow optimisation (after the shared modules land)

1. Job-completion → invoice → payment guided sequence (FLOW-1; depends on payment-sync + share helpers)
2. One-click overdue reminders + bulk bucket reminders (FLOW-2; depends on outbox unification)
3. Communications as top-level sidebar section; `/outbox` redirect (FLOW-3)
4. Documents hub with tabs + per-job document timeline (FLOW-4; depends on document kit)
5. Global ⌘K search / command palette (FLOW-5)
6. Standard loading/empty/not-found/error contract on all pages (FLOW-6)
7. Quote follow-up nudges + draft expiry policy (FLOW-8)

---

## Verification checklist (post-merge)

```bash
bunx tsc --noEmit
bun run lint
bun run test:unit
bun run qa:data-integrity    # payment sync, tenant scoping
bun run qa:pdf-smoke         # PDF route merges
bun run qa:http-security     # auth gate merges
```

Manual:

- Dashboard, Reports and AI Insights show the **same revenue** for the current month (or clearly labelled variants)
- Record payment on invoice → job `clientPaid` syncs
- Download job PDF vs WhatsApp-send same PDF → byte-compare / visual-compare
- Share credit note / receipt via WhatsApp → outbox row + Messages tab consistent
- `/platform` and `/platform-admin` (or its redirect) load without error; gates match
- All `/documents/*` pages show a proper title and the shared filter UI
- Dates render DD/MM/YYYY everywhere; money renders UGX everywhere

---

## Open questions for reviewers

1. **Prisma scoper:** canonical = `orgDb` (current usage) or finish migrating to `scopedDb` (documented as preferred)?
2. **Revenue definition:** for the "this month" headline, is cash-received (dashboard) or completed-job value (reports) the business's number? Both can be shown, but one must be the headline everywhere.
3. **Document share:** standardize on PDF **links** vs **attachments** for all document types?
4. **Platform routes:** are `/platform` and `/platform-admin` both needed long-term, or is one legacy?
5. **Date locale:** confirm DD/MM/YYYY (en-GB, EAT) as the platform-wide display standard.
6. **Audit tables:** `AuditLog` (job-scoped) vs `SystemAuditEvent` (platform) — document policy before merging write paths.

---

*Supersedes `duplication-review.md`. Update this doc as refactors land.*
