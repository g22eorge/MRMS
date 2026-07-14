# Phase 3 — Structural refactors: progress log

**Branch:** `phase-0-bug-triage` (continued)  
**Source plan:** [`system-analysis.md`](./system-analysis.md) → Consolidation roadmap → Phase 3  
**Method:** one fix at a time; document in `docs/fixes/`; one commit per fix.

| # | Task | Status | Commit | Tested |
|---|------|--------|--------|--------|
| 3.1 | Prisma scoper consolidation | ✅ Done | f381b80 | ✅ tsc |
| 3.2 | `components/documents/` kit (receipts + delivery-notes first) | ✅ Done | 05ad68c | ✅ tsc |
| 3.3 | Line-item form primitives | ✅ Done | 00253a6 | ✅ tsc |
| 3.4 | `components/ui/Modal.tsx` | ✅ Done | 2a48afb | ✅ tsc |
| 3.5 | Consolidate `/platform` + `/platform-admin` | ✅ Done | — | — |

---

## Log

### 3.1 — Prisma scoper consolidation (f381b80)

**Change:** Unified `orgDb` and `scopedDb` on `scopedDb` implementation; shared model list in `lib/org-scoped-models.ts`; canonical entry `lib/db.ts`; removed duplicate `orgDb` from `lib/prisma.ts`.

**Doc:** [`fixes/phase-3-1-prisma-scoper.md`](./fixes/phase-3-1-prisma-scoper.md)

### 3.2 — Document page kit (05ad68c)

**Change:** Added `components/documents/*` and `lib/documents/period-filters.ts`; migrated receipts and delivery-notes to shared header, KPI, filters, share menu, and table shell.

**Doc:** [`fixes/phase-3-2-document-kit.md`](./fixes/phase-3-2-document-kit.md)

### 3.3 — Line-item form primitives (00253a6)

**Change:** Added `lib/forms/line-items.ts`, `hooks/useLineItemsState.ts`, and `components/forms/*`; migrated six create forms off local `keyCounter`/`nextId` patterns.

**Doc:** [`fixes/phase-3-3-line-item-forms.md`](./fixes/phase-3-3-line-item-forms.md)

### 3.4 — Shared Modal component (2a48afb)

**Change:** Added `components/ui/Modal.tsx` and `lib/ui/modal.ts`; migrated ConfirmDialog, CreateReceiptDialog, CreateCreditNoteDialog, and SetTargetDialog to shared overlay/Escape/panel shell.

**Doc:** [`fixes/phase-3-4-modal.md`](./fixes/phase-3-4-modal.md)

### 3.5 — Platform route consolidation

**Change:** Canonical `/platform` tree with legacy `/platform-admin` redirects; shared routes/revalidate/login-redirect helpers; unified platform-admin gates; login redirect to `/platform`; extracted admin org modules action.

**Doc:** [`fixes/phase-3-5-platform-routes.md`](./fixes/phase-3-5-platform-routes.md)

---

**Phase 3 status:** ✅ Complete (3.1–3.5)
