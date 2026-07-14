# Fix 2.2 — Unified payment sync helpers

**Phase:** 2 (data correctness & trust)  
**Source:** [`system-analysis.md`](../system-analysis.md) finding on payment sync / Phase 2 item 2  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Recording or editing a payment duplicated the same reconciliation logic in five places:

| Location | Invoice sync | Sale sync |
|----------|-------------|-----------|
| `documents/receipts/page.tsx` | create / update / delete | create / update / delete |
| `documents/invoices/page.tsx` | add payment | — |
| `jobs/[id]/actions.ts` | record client payment (+ refunds) | — |
| `payout-followups/page.tsx` | receive invoice payment | — |
| `pos/[id]/page.tsx` | — | add payment + recalc totals |

Each copy: sum payments → compare to total → update `invoice.status/paidAmount/paidAt` → mirror `job.clientPaid*`. Drift risk: invoice marked PAID in one UI while the job still shows unpaid.

Inconsistencies found during consolidation:

- Invoices page hardcoded `baseCurrency: "UGX"` instead of org `baseCurrency`
- Payout follow-ups summed raw payment amounts (no FX normalization)
- Job payment path netted REFUND rows; receipt paths did not (now centralized with default `netRefunds: true`)

---

## Change

### New: `lib/commercial/payment-sync.ts`

| Export | Purpose |
|--------|---------|
| `sumInvoicePaidAmount()` | Sum invoice payments in org base currency; REFUND rows net off by default |
| `syncInvoicePaymentState()` | Update invoice paid fields + linked job `clientPaid*` (org-scoped `updateMany`) |
| `syncSalePaymentState()` | Update sale `paidAmount` / `paidAt` / `status` from payment aggregate |

### Call sites migrated

All five entry points now call the shared helpers inside their existing transactions, after `payment.create` / `update` / `delete` and `createReceiptForPayment` where applicable.

Job payment action still updates `invoiceNumber` / `invoiceIssuedAt` on the job in a separate write after sync (non-payment fields).

---

## Verification

```bash
pnpm exec tsc --noEmit
```

Manual:

1. Record payment on invoice from **Invoices** → job shows paid when fully collected
2. Create receipt from **Receipts** → invoice + job stay in sync
3. Record payment on job **Payments** tab (including partial) → invoice status matches
4. Add POS sale payment → sale status flips to PAID at threshold

---

## Next

Phase 2.3: `lib/notifications/share-document.ts` — unify document share actions.
