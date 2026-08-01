# Fix 1.4 — Job PDF routes use shared generators

**Phase:** 1 (safe, high ROI)  
**Source:** [`system-analysis.md`](../system-analysis.md) finding 3 / Phase 1 item 4  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Three job PDF HTTP routes duplicated logic that already existed in `lib/pdf/generate-*.ts`:

| Route | Was (lines) | Duplicated |
|-------|------------:|------------|
| `app/api/jobs/[id]/quotation/route.ts` | ~264 | PDF props, logo helpers, `prettyEnum`, `renderToBuffer` |
| `app/api/jobs/[id]/invoice/route.ts` | ~364 | Same + invoice persistence |
| `app/api/jobs/[id]/job-card/route.ts` | ~209 | Same + status QR code |

WhatsApp sends already used `generateQuotationBuffer`, `generateInvoiceBuffer`, `generateJobCardBuffer` from `jobs/[id]/actions.ts` — so **download and WhatsApp could produce different PDFs**.

---

## Change

### New: `lib/pdf/pdf-response.ts`

- `pdfAttachmentResponse(buffer, filename)` — standard PDF download response
- `pdfGenerationErrorResponse(message, status)`
- `jobPdfErrorStatus(message)` — maps generator errors to 404/402/409/500

### Enhanced generators

| File | Enhancement |
|------|-------------|
| `generate-job-card.ts` | Status QR code (matches HTTP route); `logAudit` option for read-only downloads |
| `generate-invoice.ts` | `persistInvoiceRecord` (full Invoice row + numbering for HTTP download); `skipPersist` (read-only re-download); richer PDF props aligned with former HTTP route; try/catch on render |

### Thin HTTP routes (auth + policy only)

| Route | Lines after | Calls |
|-------|------------:|-------|
| quotation | ~58 | `generateQuotationBuffer(..., !isReadOnly, ...)` |
| job-card | ~38 | `generateJobCardBuffer(..., { logAudit })` |
| invoice | ~68 | `generateInvoiceBuffer(..., { persistInvoiceRecord \| skipPersist })` |

**Route responsibilities kept in routes:** session/role gates, read-only workspace checks, `assertOrgCanMutate` for invoice writes.

**Route responsibilities moved to generators:** PDF assembly, branding, logo resolution, DB stamp/audit, `renderToBuffer`.

---

## Verification

```bash
pnpm exec tsc --noEmit   # no errors in touched PDF files
bun run qa:pdf-smoke     # when dev server available
```

**Manual:**

1. Download quotation / invoice / job-card PDF from a job → file opens, branding intact
2. Send same document via WhatsApp → should match download output (same generator path)
3. Read-only org: can re-download existing quotation/invoice; cannot create new ones (402)

---

## Follow-ups

- Phase 1.5: remove dead `writePaymentAccountingDocuments`, `orgWhere`, `SettingsPageHeader`
- EagleInfo finance PDF cluster (`credit-notes`, `refunds` API routes) — separate refactor
- Add unit test for `generateInvoiceBuffer({ persistInvoiceRecord: true })` with test DB
