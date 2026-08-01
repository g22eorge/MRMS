# Phase 2 — Data correctness & trust: progress log

**Branch:** `phase-0-bug-triage` (continued)  
**Source plan:** [`system-analysis.md`](./system-analysis.md) → Consolidation roadmap → Phase 2  
**Method:** one fix at a time; document in `docs/fixes/`; one commit per fix.

| # | Task | Status | Commit | Tested |
|---|------|--------|--------|--------|
| 2.1 | `lib/ai/business-metrics.ts` + revenue labels | ✅ Done | b46d181 | ✅ tsc |
| 2.2 | `lib/commercial/payment-sync.ts` | ✅ Done | 61ef225 | ✅ tsc |
| 2.3 | `lib/notifications/share-document.ts` | ✅ Done | 18bc3a5 | ✅ tsc |
| 2.4 | `lib/phone.ts` | ✅ Done | c3ee47a | ✅ tsc |
| 2.5 | Route `sendPdfViaWhatsApp` through outbox | ✅ Done | 409a923 | ✅ tsc |

---

## Log

### 2.1 — Shared business metrics pack (b46d181)

**Change:** Added `lib/ai/business-metrics.ts` with `buildBusinessDataPack()`; AI Insights + copilot consume it; cash received uses `loadCashCollectionsByChannel` (matches Dashboard/Reports); UI labels distinguish cash received vs completed repair value.

**Doc:** [`fixes/phase-2-1-business-metrics.md`](./fixes/phase-2-1-business-metrics.md)

### 2.2 — Payment sync helpers (61ef225)

**Change:** Added `syncInvoicePaymentState` / `syncSalePaymentState`; migrated receipts, invoices, jobs, payout-followups, and POS payment paths.

**Doc:** [`fixes/phase-2-2-payment-sync.md`](./fixes/phase-2-2-payment-sync.md)

### 2.3 — Document share helpers (18bc3a5)

**Change:** Added `lib/notifications/share-document.ts`; receipts, credit notes, refunds, and delivery notes delegate WhatsApp/email share to shared recipient resolution + outbox enqueue.

**Doc:** [`fixes/phase-2-3-share-document.md`](./fixes/phase-2-3-share-document.md)

### 2.4 — Phone normalization (c3ee47a)

**Change:** Added `lib/phone.ts`; SMS, WhatsApp, webhook, and clients pages use shared normalize/display helpers; new clients stored as E.164 with duplicate lookup across format variants.

**Doc:** [`fixes/phase-2-4-phone-normalization.md`](./fixes/phase-2-4-phone-normalization.md)

### 2.5 — WhatsApp PDF outbox (409a923)

**Change:** Added `lib/notifications/whatsapp-document-outbox.ts`; job PDF WhatsApp sends enqueue document metadata and deliver through `deliverOutboundMessage` with unified retry/error handling.

**Doc:** [`fixes/phase-2-5-whatsapp-pdf-outbox.md`](./fixes/phase-2-5-whatsapp-pdf-outbox.md)

---

**Phase 2 status:** All items complete (2.1–2.5).
