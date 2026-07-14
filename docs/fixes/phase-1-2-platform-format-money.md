# Fix 1.2 — Platform pages use shared `formatMoney`

**Phase:** 1 (safe, high ROI)  
**Source:** [`system-analysis.md`](../system-analysis.md) UX-3 / finding 11 / Phase 1 item 2  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Platform admin pages showed **`USh 0`** (Intl `style: "currency"` with `en-UG` locale) while the rest of the app shows **`UGX 0`** via `lib/currency.ts` → `formatMoney()`.

Five platform surfaces defined a local `fmtMoney` instead of importing the shared helper.

---

## Root cause

```ts
// Before — renders ISO symbol "USh" for Uganda shilling
new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(n)
```

App standard:

```ts
// lib/currency.ts — explicit code prefix
formatMoney(n, "UGX") // → "UGX 1,000"
```

---

## Change

| File | Change |
|------|--------|
| `app/(platform)/platform/page.tsx` | Removed local `fmtMoney`; use `formatMoney` for revenue KPIs |
| `app/(platform)/platform/payments/page.tsx` | Same; billing table uses `normalizeCurrency(e.currency, "UGX")` |
| `app/(platform)/platform/orgs/[id]/page.tsx` | Same for Total Paid KPI and billing history |
| `app/(platform)/platform/settings/page.tsx` | Removed duplicate `UGX` prefix (`UGX UGX …` bug) |

`platform/settings/page.tsx` already imported `formatMoney` but prefixed `UGX` manually — now shows `{formatMoney(PLAN_PRICES[plan])} / month` once.

---

## Verification

```bash
pnpm exec tsc --noEmit   # no errors in platform pages
pnpm test tests/unit/currency.test.ts   # formatMoney contract unchanged
```

**Manual:** Open `/platform` and `/platform/payments` — revenue figures read `UGX 0` (or `UGX 1,000` etc.), not `USh …`.

---

## Follow-ups

- Phase 1.3: unify **date** display (platform still uses `en-UG` short dates for billing timestamps — separate from currency).
- Other app pages with inline `Intl.NumberFormat` (quotation forms, copilot route) — later passes.
