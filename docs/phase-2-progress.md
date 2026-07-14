# Phase 2 — Data correctness & trust: progress log

**Branch:** `phase-0-bug-triage` (continued)  
**Source plan:** [`system-analysis.md`](./system-analysis.md) → Consolidation roadmap → Phase 2  
**Method:** one fix at a time; document in `docs/fixes/`; one commit per fix.

| # | Task | Status | Commit | Tested |
|---|------|--------|--------|--------|
| 2.1 | `lib/ai/business-metrics.ts` + revenue labels | ✅ Done | — | ✅ tsc |
| 2.2 | `lib/commercial/payment-sync.ts` | ⬜ Pending | — | — |
| 2.3 | `lib/notifications/share-document.ts` | ⬜ Pending | — | — |
| 2.4 | `lib/phone.ts` | ⬜ Pending | — | — |
| 2.5 | Route `sendPdfViaWhatsApp` through outbox | ⬜ Pending | — | — |

---

## Log

### 2.1 — Shared business metrics pack

**Change:** Added `lib/ai/business-metrics.ts` with `buildBusinessDataPack()`; AI Insights + copilot consume it; cash received uses `loadCashCollectionsByChannel` (matches Dashboard/Reports); UI labels distinguish cash received vs completed repair value.

**Doc:** [`fixes/phase-2-1-business-metrics.md`](./fixes/phase-2-1-business-metrics.md)
