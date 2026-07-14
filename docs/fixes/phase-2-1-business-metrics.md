# Fix 2.1 — Shared business metrics pack + revenue labels

**Phase:** 2 (data correctness & trust)  
**Source:** [`system-analysis.md`](../system-analysis.md) UX-1 / Phase 2 item 1  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

The same month showed contradictory “revenue” on different surfaces:

| Surface | Was showing | Definition |
|---------|-------------|------------|
| Dashboard | UGX 6.3M | Cash received (payments) |
| Reports executive | UGX 0 (older) / mixed labels | Now uses collections; repair sections used completed value |
| AI Insights | UGX 0 | Mixed completed repair value + paid invoice/sale totals |

Root causes:

1. ~160 lines of duplicated KPI queries in `ai-insights/page.tsx` and `api/ai-business-copilot/route.ts`
2. AI pack counted **completed job bill** as “repair revenue” but also added **paid** sales/invoices — inconsistent with dashboard collections
3. UI labels all said “Revenue” with no distinction between **cash received** and **completed repair value**

---

## Change

### New: `lib/ai/business-metrics.ts`

- `buildBusinessDataPack(orgId, asOf?)` — single tenant-scoped metrics pack
- `OPEN_JOB_STATUSES`, `pctChange`, `trendLabel`, `changePhrase` helpers
- **Explicit finance semantics:**
  - `finance.cashReceived*` — via `loadCashCollectionsByChannel` (same as Dashboard/Reports)
  - `finance.completedRepairValue*` — client bill on jobs completed in period
  - `finance.cashReceivedByChannel` — repairs / products / corporate breakdown

### Consumers

| File | Change |
|------|--------|
| `app/(app)/ai-insights/page.tsx` | Uses `buildBusinessDataPack`; KPI renamed **Cash Received**; repair panel shows both completed value and collections |
| `app/api/ai-business-copilot/route.ts` | Imports shared pack; removed ~170 lines of duplicate queries |

### UI label alignment (UX-1)

| Surface | Label |
|---------|-------|
| Dashboard admin MTD card | **Cash received** / **Cash received this month** |
| Reports executive scorecard | **Cash received** |
| Reports mobile tiles | **Cash received** (collections) + **Repair value** (completed jobs) |
| AI Insights headline KPI | **Cash Received** with completed repair value in caption |

---

## Verification

```bash
pnpm exec tsc --noEmit
```

Manual: for current month, Dashboard MTD total, Reports executive **Cash received**, and AI Insights **Cash Received** should match (same payment-based definition). Completed repair value may differ — that is expected and now labeled.

---

## Next

Phase 2.2: `lib/commercial/payment-sync.ts` — unify payment entry points and invoice/job paid-state sync.
