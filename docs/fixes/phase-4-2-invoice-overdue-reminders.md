# Fix 4.2 — One-click overdue invoice reminders

**Phase:** 4 (workflow)  
**Source:** [`system-analysis.md`](../system-analysis.md) FLOW-2 / Phase 4 item 2  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

The invoices page showed aging buckets and overdue callouts but had no collection action attached. Staff had to open each job or use generic “Share Invoice on WhatsApp” from row menus — not an overdue-specific reminder through the outbox.

---

## Change

### Reminder engine (`lib/commercial/invoice-reminders.ts`)

- Computes days overdue from `dueDate` or `issuedAt`
- Builds WhatsApp/email copy with balance, overdue days, and repair-job PDF link when available
- Dispatches via `enqueueWhatsAppMessage` / `enqueueEmailMessage` (WhatsApp preferred, email fallback)
- Logs `OVERDUE_REMINDER_SENT` system audit events
- Supports single invoice and bulk by aging bucket (`1-30`, `31-60`, `61+`)

### Server actions

- `app/(app)/documents/invoices/reminder-actions.ts`
  - `sendOverdueInvoiceReminderAction`
  - `sendOverdueInvoiceRemindersBulkAction`

### Invoices UI

- **Send reminder** on overdue rows (mobile list, desktop table, critical overdue panel, mobile overdue header)
- **Remind all in bucket** when an aging filter is active (mobile overdue panel + desktop bucket bar)
- Success/error banners via query params (`reminded`, `remindedBulk`, `reminderError`)

### Tests

- `tests/unit/invoice-reminders.test.ts`

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/invoice-reminders.test.ts
```

Manual: filter invoices to an overdue bucket → **Remind all in bucket** → check outbox rows; single row **Send reminder** → confirm WhatsApp/email queued.

---

## Files

| File | Role |
|------|------|
| `lib/commercial/invoice-reminders.ts` | Reminder copy + outbox dispatch |
| `app/(app)/documents/invoices/reminder-actions.ts` | Server actions |
| `components/documents/InvoiceOverdueReminderForms.tsx` | Reminder form buttons |
| `app/(app)/documents/invoices/page.tsx` | UI wiring + feedback banners |
