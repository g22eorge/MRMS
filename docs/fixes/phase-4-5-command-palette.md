# Fix 4.5 — Global ⌘K command palette

**Phase:** 4 (workflow)  
**Source:** [`system-analysis.md`](../system-analysis.md) FLOW-5 / Phase 4 item 5  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Every list page had its own search box with different placeholders and scopes. Quick actions (New Job, Record Payment, etc.) lived only on the dashboard. Staff had no global way to jump to a job, client, or invoice from anywhere in the app.

---

## Change

### Command palette UI

- **`CommandPalette`** mounted in the app shell — opens with **⌘K / Ctrl+K** or the header **Search** button
- Keyboard navigation (↑ ↓ Enter, Esc)
- Debounced search input with grouped results

### Server search API

- **`GET /api/command-palette?q=`** — org-scoped, role-aware
- Searches **jobs** (by ref, client, phone, device), **clients** (name, phone, email), **invoices** (number, client, job ref)
- Respects technician assignment scoping and hides client PII from external tech job hits

### Quick actions

- **`buildCommandPaletteQuickActions`** mirrors dashboard verbs: New Job, Record Payment, POS Sale, Add Expense, Purchase Order, New Intake
- Adds navigation shortcuts: Jobs, Clients, Invoices, Outbox, Dashboard
- Filtered by role/permissions

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/command-palette.test.ts
```

Manual:

1. Press **⌘K** (or tap Search on mobile) from any page.
2. Type a job number / client phone / invoice number → jump to the right place.
3. With empty query, quick actions reflect your role.

---

## Files

| File | Role |
|------|------|
| `lib/command-palette/types.ts` | Action + search hit types |
| `lib/command-palette/quick-actions.ts` | Role-gated quick actions |
| `lib/command-palette/search.ts` | Org-scoped search queries |
| `app/api/command-palette/route.ts` | Palette API |
| `components/command-palette/CommandPalette.tsx` | Modal UI + keyboard handling |
| `components/layout/Header.tsx` | Search trigger button |
| `app/(app)/layout.tsx` | Global mount |
| `tests/unit/command-palette.test.ts` | Quick action tests |
