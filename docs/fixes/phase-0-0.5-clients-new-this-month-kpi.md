# Fix 0.5 — Clients "New This Month" KPI

**Phase:** 0 (visible-bug triage)  
**Source:** [`system-analysis.md`](../system-analysis.md) UX-9 / Phase 0 item 5  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

The Clients page KPI tile showed **"New This Month"** with a subtitle like `+77 this month` when total clients was also 77 — implying every client was "new" this month. That happened because:

1. The count used only `createdAt >= monthStart`, which treats bulk-imported clients as new when their `createdAt` was set at import time.
2. The subtitle repeated the same number (`+{n} this month`), which looked broken even when the count was correct.

---

## Root cause

```ts
// Before — counts any client row created this calendar month
db.client.count({ where: { createdAt: { gte: monthStart } } })
```

Imported clients often arrive with historical jobs. Their `createdAt` may fall in the current month while their repair history spans earlier months — they are not genuinely "new" customers.

---

## Change

**File:** `app/(app)/clients/page.tsx`

1. **Query:** Count clients created this month **and** with no jobs received before the month start:

```ts
db.client.count({
  where: {
    createdAt: { gte: monthStart },
    jobs: { none: { receivedAt: { lt: monthStart } } },
  },
})
```

2. **Copy:** Subtitle changed from `+{n} this month` → `first seen this month` (describes the metric without echoing the number).

---

## Verification

Against `mrms-prod.db` (July 2026):

| Metric | Value |
|--------|------:|
| Total clients | 77 |
| Old KPI (createdAt only) | 8 |
| New KPI (with job-history guard) | 8 |

On this snapshot both queries agree because July-created clients have no pre-July jobs. The guard prevents the **77/77** failure mode when imports set `createdAt` to the import date for clients with older job history.

**Manual:** Open `/clients` → "New This Month" tile shows a sensible count and subtitle "first seen this month".

---

## Follow-ups

None for Phase 0. Segment chip `{n} no job` remains a separate metric (clients with zero jobs ever).
