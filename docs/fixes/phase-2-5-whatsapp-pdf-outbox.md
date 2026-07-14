# Fix 2.5 — Route job PDF WhatsApp sends through outbox

**Phase:** 2 (data correctness & trust)  
**Source:** [`system-analysis.md`](../system-analysis.md) finding 5 / Phase 2 item 5  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

`sendPdfViaWhatsApp` in `app/(app)/jobs/[id]/actions.ts` manually created an `OutboundMessage` row, uploaded media, called Meta directly, and updated status with ad-hoc error handling. Staff text replies already used `enqueueWhatsAppMessage` → `deliverOutboundMessage`, so PDF sends skipped unified retry/backoff, terminal error codes, and lock semantics.

---

## Change

### New: `lib/notifications/whatsapp-document-outbox.ts`

| Export | Purpose |
|--------|---------|
| `WHATSAPP_PDF_DOCUMENT_KEY` | Marks outbox rows as PDF document deliveries |
| `enqueueWhatsAppDocument()` | Creates outbox row with document metadata in `templateVars` |
| `deliverWhatsAppPdfDocument()` | Regenerates PDF, uploads media, sends document, writes audit log |
| `parseWhatsAppDocumentVars()` / `isWhatsAppPdfDocumentRow()` | Delivery routing helpers |

Document metadata stores `documentKind` (`quotation` \| `invoice` \| `job_card`), filename, caption, staff context, and audit fields. PDF bytes are regenerated on delivery/retry so retries do not depend on ephemeral buffers.

### Updated: `lib/notifications/whatsapp-outbox.ts`

`deliverOutboundMessage()` branches to `deliverWhatsAppPdfDocument()` when `templateKey === WHATSAPP_PDF_DOCUMENT_KEY`.

### Updated: `app/(app)/jobs/[id]/actions.ts`

`sendPdfViaWhatsApp` now enqueues via `enqueueWhatsAppDocument` and delivers through `deliverOutboundMessage`. Quotation/invoice/job-card actions still pre-validate PDF generation, then pass metadata only.

### Updated: `lib/notifications/whatsapp.ts`

`sendWhatsAppDocument` returns `errorCode` for consistent terminal recipient handling in the outbox.

### Test

`tests/unit/whatsapp-document-outbox.test.ts` — metadata parsing + row detection.

---

## Verification

```bash
pnpm exec tsc --noEmit
bun test tests/unit/whatsapp-document-outbox.test.ts
```

Manual: send quotation/invoice/job card via WhatsApp on a job → outbox row appears as PENDING then SENT (or FAILED with `lastError`); failed rows retry via cron with same metadata.

---

## Phase 2 complete

All Phase 2 items (2.1–2.5) are now applied on branch `phase-0-bug-triage`.
