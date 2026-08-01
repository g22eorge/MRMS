# Fix 3.3 — Line-item form primitives

**Phase:** 3 (structural)  
**Source:** [`system-analysis.md`](../system-analysis.md) UX-6 / Phase 3 item 3  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Six create forms duplicated line-item state management (`nextId`, `keyCounter`, local `JSON.stringify(lines)`) and repeated customer/line table UI for commercial documents and inventory procurement flows.

---

## Change

### New: `lib/forms/line-items.ts`

Shared helpers: `createLineItemKey`, `parseFormNumber`, `appendJsonLineItems`, commercial line types/totals, client picker types.

### New: `hooks/useLineItemsState.ts`

Generic hook for add/remove/update/serialize/append-to-FormData line rows.

### New: `components/forms/`

| Component | Purpose |
|-----------|---------|
| `LineItemsPanel` | Panel shell + `PartSelect` + shared input class |
| `CustomerPicker` / `useCustomerPicker` | Existing/new client picker for standalone invoices |
| `CommercialLineItemsEditor` | Invoice/quotation-style line table with discount |

### Migrated forms

| Form | Primitives used |
|------|-----------------|
| `NewPurchaseRequestForm` | `useLineItemsState`, `LineItemsPanel`, `PartSelect` |
| `NewPurchaseOrderForm` | `useLineItemsState`, `PartSelect`, `parseFormNumber` |
| `NewStockCountForm` | `useLineItemsState`, `LineItemsPanel`, `PartSelect` |
| `NewSupplierBillForm` | `useLineItemsState`, `LineItemsPanel`, `replaceLines` for PO/GRN preload |
| `CreateStandaloneInvoiceForm` | `useCustomerPicker`, `CustomerPicker`, `CommercialLineItemsEditor`, `useLineItemsState` |
| `NewQuotationForm` | `CommercialLineItemsEditor`, `useLineItemsState` (customer source UI unchanged) |

### Test

`tests/unit/line-items.test.ts`

---

## Verification

```bash
pnpm exec tsc --noEmit
bun test tests/unit/line-items.test.ts
```

Manual: create flows for purchase request/order, stock count, supplier bill, standalone invoice, and quotation — add/remove lines, part select, submit payload includes `items` JSON.

---

## Next

Phase 3.4: `components/ui/Modal.tsx`.
