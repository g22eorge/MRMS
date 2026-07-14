# Fix 4.7 — Quote follow-up nudges + draft expiry policy

**Phase:** 4 (workflow)  
**Source:** [`system-analysis.md`](../system-analysis.md) FLOW-8 / Phase 4 item 7  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

The quotations page tracked awaiting-client counts but had no follow-up action for stale quotes. Staff could only re-share via row menus (WhatsApp/email) without outbox-backed follow-up copy or bulk nudges. Draft quotations could accumulate indefinitely with no expiry policy.

---

## Change

### Follow-up engine (`lib/commercial/quote-followups.ts`)

- Computes days pending from `sentAt`, `quotedAt`, or `updatedAt`
- Builds WhatsApp/email follow-up copy with quote number, amount, and PDF link
- Dispatches via `enqueueWhatsAppMessage` / `enqueueEmailMessage` (WhatsApp preferred, email fallback)
- Logs `QUOTE_FOLLOWUP_SENT` system audit events
- Supports single job, single standalone quotation, and bulk (up to 50 awaiting jobs + 50 SENT quotations)
- Draft expiry policy: marks stale `DRAFT` rows as `EXPIRED` when `validUntil` passed or age ≥ 30 days; logs `QUOTATION_DRAFT_EXPIRED`

### Server actions

- `app/(app)/documents/quotations/followup-actions.ts`
  - `sendQuoteFollowUpAction`
  - `sendQuoteFollowUpsBulkAction`
  - `expireStaleQuotationDraftsAction`

### Quotations UI

- **Send follow-up** on awaiting repair jobs and standalone `SENT` rows
- **Follow up all awaiting** bulk button in header when targets exist
- **Expire stale drafts** panel when policy-eligible drafts are present
- Success/error banners via query params (`followupSent`, `followupBulk`, `expiredDrafts`, `followupError`)

### Tests

- `tests/unit/quote-followups.test.ts`

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/quote-followups.test.ts
```

Manual: open `/documents/quotations` with awaiting quotes → **Send follow-up** on a row → confirm outbox row; **Follow up all awaiting** → check bulk summary banner; with stale drafts → **Expire stale drafts** → confirm status becomes `EXPIRED`.

---

## Files

| File | Role |
|------|------|
| `lib/commercial/quote-followups.ts` | Follow-up copy + outbox dispatch + draft expiry |
| `app/(app)/documents/quotations/followup-actions.ts` | Server actions |
| `components/documents/QuotationFollowUpForms.tsx` | Follow-up form buttons |
| `app/(app)/documents/quotations/page.tsx` | UI wiring + feedback banners |
| `tests/unit/quote-followups.test.ts` | Unit tests |
