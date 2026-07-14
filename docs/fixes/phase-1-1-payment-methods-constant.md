# Fix 1.1 — Shared payment method constants

**Phase:** 1 (safe, high ROI)  
**Source:** [`system-analysis.md`](../system-analysis.md) finding 13 / Phase 1 item 1  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

The same payment method list was copy-pasted in **5 pages**:

```ts
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CARD", "OTHER"];
```

Each page also reimplemented validation (`PAYMENT_METHODS.includes(...)`) and label formatting (`replace("_", " ")` / `replaceAll`).

---

## Change

**New file:** `lib/constants/payment-methods.ts`

- `PAYMENT_METHODS` — canonical readonly array
- `parsePaymentMethod(raw, fallback)` — shared validation with per-flow fallback (`CASH` vs `OTHER`)
- `formatPaymentMethodLabel(method)` — human-readable labels

**Updated consumers:**

| File | Fallback |
|------|----------|
| `documents/invoices/page.tsx` | `OTHER` |
| `documents/receipts/page.tsx` | `OTHER` |
| `documents/credit-notes/page.tsx` | `CASH` |
| `documents/refunds/page.tsx` | `CASH` |
| `payout-followups/page.tsx` | `OTHER` |

Per-flow fallbacks preserved intentionally — this fix only centralises the list and parsing helper.

---

## Verification

```bash
pnpm exec tsc --noEmit   # no new errors in touched files (pre-existing queue/redis errors remain)
```

**Manual:** Open receipts/invoices payment forms — method dropdown unchanged (CASH, MOBILE MONEY, etc.).

---

## Follow-ups

- Phase 1 (optional next): `components/finance/PaymentFields.tsx` for shared amount/method/reference inputs.
- `CreateReceiptDialog.tsx` still maps methods locally — can import `PAYMENT_METHODS` in a later pass.
