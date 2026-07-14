# Fix 1.3 — Shared date ranges and EAT display policy

**Phase:** 1 (safe, high ROI)  
**Source:** [`system-analysis.md`](../system-analysis.md) UX-4 / finding 12 / Phase 1 item 3  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Two user-visible date issues:

1. **Display drift:** Invoices/receipts used bare `toLocaleDateString()` → **M/D/YYYY** (US locale). Jobs/quotations already used `formatEATDate()` → **DD/MM/YYYY** (`en-GB`, EAT).
2. **Range drift:** `monthRange` was defined **four times** with two incompatible signatures (`(year, month)` vs `(Date)`), blocking a shared metrics pack (Phase 2.1).

---

## Policy (now canonical)

| Concern | Module | Standard |
|---------|--------|----------|
| List/table dates | `lib/date-eat.ts` | `en-GB` locale, `Africa/Nairobi` timezone |
| Full date | `formatEATDate()` | e.g. `15/01/2025` |
| Date + time | `formatEATDate` + `formatEATTime()` | receipts, delivery notes |
| Medium label | `formatEATMediumDate()` | e.g. `15 Jan 2025` |
| Short label | `formatEATShortDate()` | e.g. `15 Jan` |
| Month bounds | `lib/date-ranges.ts` | `monthRange(year, month)` — month is **1-indexed** |
| Month from instant | `monthRangeFromDate(date)` | AI metrics |
| Previous month | `previousMonthRange(date)` | AI metrics |

---

## Change

### New: `lib/date-ranges.ts`

Exports: `monthRange`, `monthRangeFromDate`, `previousMonthRange`, `yearRange`, `monthLabel`, `monthSequence`, `daysBetween`.

### Extended: `lib/date-eat.ts`

Added `formatEATShortDate`, `formatEATMediumDate`, `formatEATTime`.

### Document pages (UX-4 fix)

| Page | Before | After |
|------|--------|-------|
| invoices | `toLocaleDateString()` | `formatEATDate` / `formatEATShortDate` |
| receipts | locale-default date/time | `formatEATDate` + `formatEATTime` |
| refunds | `toLocaleDateString()` | `formatEATDate` |
| delivery-notes | locale-default | `formatEATDate` + `formatEATTime` |
| credit-notes | `en-UG` inline | `formatEATMediumDate` |

### Metrics consumers (dedupe)

Removed local `monthRange` copies from:

- `app/(app)/dashboard/page.tsx`
- `app/(app)/reports/page.tsx`
- `app/(app)/ai-insights/page.tsx`
- `app/api/ai-business-copilot/route.ts`

### Platform billing dates

- `platform/payments/page.tsx` and `platform/orgs/[id]/page.tsx` → `formatEATMediumDate` (was `en-UG` inline).

---

## Verification

```bash
pnpm exec tsc --noEmit
bun test tests/unit/date-eat.test.ts tests/unit/date-ranges.test.ts
```

**Manual:** Compare `/documents/invoices` and `/documents/quotations` — dates should both read **DD/MM/YYYY** (or `15 Jan 2025` where medium format is used).

---

## Follow-ups

- Phase 2.1: `buildBusinessDataPack()` still separate in AI page + copilot route — can now import shared `monthRangeFromDate`.
- Remaining inline dates: outbox page, users page, audit pages, `JobDetailTabs.tsx` — migrate incrementally.
