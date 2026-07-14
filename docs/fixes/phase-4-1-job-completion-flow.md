# Fix 4.1 — Job completion → invoice → payment guided flow

**Phase:** 4 (workflow)  
**Source:** [`system-analysis.md`](../system-analysis.md) FLOW-1 / Phase 4 item 1  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

When staff marked a job **Completed**, billing was fragmented: invoice generation lived on document links, WhatsApp send on the Messages tab, and payment recording on Financials. Nothing guided ADMIN/OPS through the natural sequence after completion.

The mobile primary status CTA also submitted `status` instead of `nextStatus`, so quick status advances could fail silently.

---

## Change

### Guided completion modal (`JobCompletionFlowModal`)

After a successful transition to `COMPLETED`, users with invoice/financial permissions and a positive client bill see a three-step modal:

1. **Issue invoice** — `issueJobInvoiceAction` persists org-scoped invoice record + PDF
2. **Send via WhatsApp** — `sendInvoiceViaWhatsAppAction` (skipped messaging when no client phone)
3. **Record payment** — inline form calling `recordClientPaymentAction`, or skip to Financials

Uses shared `Modal` from Phase 3.4 and payment method constants from Phase 1.

### Server

- `updateJobAction` now returns `statusChangedTo` when the persisted status changes
- New `issueJobInvoiceAction(jobId)` wraps `generateInvoiceBuffer(..., { persistInvoiceRecord: true })`

### Client wiring

- `JobDetailTabs` opens the modal on completion via `shouldOpenJobCompletionFlow()`
- Mobile overview CTA fixed: `nextStatus` field name

### Tests

- `tests/unit/completion-flow.test.ts` — open gate, initial step, step labels

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/completion-flow.test.ts
```

Manual: mark a job with client bill as **Completed** → modal appears → issue invoice → send WhatsApp → record payment (or skip steps).

---

## Files

| File | Role |
|------|------|
| `lib/jobs/completion-flow.ts` | Open gate + step helpers |
| `components/jobs/JobCompletionFlowModal.tsx` | Guided UI |
| `components/jobs/JobDetailTabs.tsx` | Wire modal + mobile fix |
| `app/(app)/jobs/[id]/actions.ts` | `statusChangedTo`, `issueJobInvoiceAction` |
