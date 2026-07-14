# Fix 3.2 — Document page kit (receipts + delivery notes)

**Phase:** 3 (structural)  
**Source:** [`system-analysis.md`](../system-analysis.md) UX-5 / Phase 3 item 2  
**Date:** 2026-07-14  
**Status:** Applied (first migration wave)

---

## Problem

Document list pages duplicated header blocks, KPI strips, period filters, share menu sections, empty states, and table wrappers. Receipts and delivery notes used different filter paradigms (form submit vs link chips) and header layouts.

---

## Change

### New: `components/documents/`

| Component | Purpose |
|-----------|---------|
| `DocumentPageHeader` | Eyebrow + title + action + optional embedded KPIs |
| `DocumentKpiStrip` | Embedded or card-grid KPI tiles |
| `DocumentFilterBar` | Search + period chips (`form` or `link` mode) + reset |
| `PeriodFilterChips` | Reusable period pill/button chips |
| `DocumentShareMenuSection` | WhatsApp/email/wa.me link block for row menus |
| `DocumentEmptyState` / `DocumentEmptyTableRow` | Consistent empty list messaging |
| `DocumentListTable` / `DocumentListTableHead` | Shared table shell |

### New: `lib/documents/period-filters.ts`

Shared period keys, labels, Prisma date filters, and in-memory matchers (uses `lib/date-ranges.ts`).

### Migrated pages

- `app/(app)/documents/receipts/page.tsx` — header, filters, share menus, table shell
- `app/(app)/documents/delivery-notes/page.tsx` — unified embedded header+KPI, filters, share menu, table shell

Invoices, quotations, credit notes, refunds remain on legacy layout (invoices last per plan).

### Test

`tests/unit/document-period-filters.test.ts`

---

## Verification

```bash
pnpm exec tsc --noEmit
bun test tests/unit/document-period-filters.test.ts
```

Manual: `/documents/receipts` and `/documents/delivery-notes` — header/KPI/filter/share/empty states render; period filters work.

---

## Next

Phase 3.3: Line-item form primitives.
