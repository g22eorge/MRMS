# Fix 4.4 — Documents hub with tabs + per-job document timeline

**Phase:** 4 (workflow)  
**Source:** [`system-analysis.md`](../system-analysis.md) FLOW-4 / Phase 4 item 4  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Document types lived as six separate list pages with independent shells. Staff chasing one client's paperwork had to jump between quotations, invoices, receipts, and delivery notes. The job detail page had PDF shortcuts scattered in menus but no unified lifecycle view.

---

## Change

### Documents hub tabs (`/documents/*`)

- **`DocumentsShell`** wraps all document list pages via `app/(app)/documents/layout.tsx`
- Tab bar covers Job Cards, Quotations, Invoices, Receipts, Delivery Notes, Credit Notes, Refunds, and Templates — filtered by role
- **`/documents`** redirects to the first relevant tab (`invoices` when available, otherwise `quotations`)
- Shared route helpers in `lib/documents/routes.ts`

Individual page implementations are unchanged; they render inside the tab shell.

### Per-job document timeline

- **`loadJobDocumentTimeline`** aggregates job card, quotations, invoice, receipts, delivery notes, and refunds for a repair job
- New **Documents** tab on job detail shows chronological lifecycle with PDF and list links
- Visible to roles that can view financials, generate job cards, or issue quotes

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/documents-routes.test.ts tests/unit/job-document-timeline.test.ts
```

Manual:

1. Open `/documents` — lands on a tabbed hub (not the old tile grid).
2. Switch tabs — each document list keeps working inside the shell.
3. Open a job → **Documents** tab — timeline shows linked paperwork in order.

---

## Files

| File | Role |
|------|------|
| `lib/documents/routes.ts` | Hub paths, nav config, role defaults |
| `components/documents/DocumentsShell.tsx` | Tab shell for document lists |
| `app/(app)/documents/layout.tsx` | Layout wrapper + access gate |
| `app/(app)/documents/page.tsx` | Redirect to default tab |
| `lib/jobs/job-document-timeline.ts` | Load + sort job document entries |
| `components/jobs/JobDocumentTimeline.tsx` | Timeline UI on job detail |
| `components/jobs/JobDetailTabs.tsx` | Documents tab |
| `app/(app)/jobs/[id]/page.tsx` | Timeline data loading |
| `tests/unit/documents-routes.test.ts` | Route + nav tests |
| `tests/unit/job-document-timeline.test.ts` | Timeline sort tests |
