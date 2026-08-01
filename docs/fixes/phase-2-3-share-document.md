# Fix 2.3 — Unified document share helpers

**Phase:** 2 (data correctness & trust)  
**Source:** [`system-analysis.md`](../system-analysis.md) finding 4 / Phase 2 item 3  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Four document pages duplicated near-identical share actions:

| Page | Actions |
|------|---------|
| `documents/receipts/page.tsx` | WhatsApp + email |
| `documents/credit-notes/page.tsx` | WhatsApp + email |
| `documents/refunds/page.tsx` | WhatsApp + email |
| `documents/delivery-notes/page.tsx` | WhatsApp + email |

Each copy: load entity by `id`+`orgId` → resolve recipient (`invoice?.job?.client ?? invoice?.client ?? sale?.client`) → build PDF URL → enqueue WhatsApp/email.

Recipient resolution is privacy-sensitive; drift between copies risks messaging the wrong client.

---

## Change

### New: `lib/notifications/share-document.ts`

| Export | Purpose |
|--------|---------|
| `resolveLinkedDocumentRecipient()` | Single priority chain for job → invoice → sale → credit-note sale client |
| `documentPdfUrl()` | Builds absolute PDF link from `NEXT_PUBLIC_APP_URL` |
| `shareReceiptDocument()` | Load payment + enqueue |
| `shareCreditNoteDocument()` | Load credit note + enqueue |
| `shareRefundDocument()` | Load refund (+ credit note fallback) + enqueue |
| `shareDeliveryNoteDocument()` | Load delivery note + enqueue |

All share functions route through `enqueueWhatsAppMessage` / `enqueueEmailMessage` (outbox path).

### Page actions thinned

Each page keeps auth gate, `revalidatePath`, and redirects; share logic delegates to the shared module.

### Test

`tests/unit/share-document.test.ts` — recipient priority + PDF URL helper.

---

## Verification

```bash
pnpm exec tsc --noEmit
bun test tests/unit/share-document.test.ts
```

Manual: share receipt / credit note / refund / delivery note via WhatsApp or email → outbox row appears with correct client phone/email.

---

## Next

Phase 2.4: `lib/phone.ts` — normalize SMS/WhatsApp/webhook + display.
