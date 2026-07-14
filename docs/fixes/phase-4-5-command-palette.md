# Fix 4.5 — Global ⌘K command palette

**Phase:** 4 (workflow)  
**Source:** [`system-analysis.md`](../system-analysis.md) FLOW-5 / Phase 4 item 5  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Every list page had its own search box with different placeholders and scopes. Quick actions (New Job, Record Payment, etc.) lived only on the dashboard. Staff could not jump to a job, client, or invoice from anywhere in the app.

---

## Change

### Global command palette

- **⌘K / Ctrl+K** opens a modal search surface from any authenticated app page
- Desktop header **Search…** button as a visible affordance
- **Quick actions** mirror the dashboard grid (New Job, Record Payment, Product Sale, Add Expense, Purchase Order, New Intake) — filtered by role and org modules
- **Navigation shortcuts** for Jobs, Clients, Invoices, and Outbox when permitted

### Live search (`/api/command-palette/search`)

Org-scoped, role-aware matches for:

- **Jobs** — job number, serial/IMEI, client name (when allowed)
- **Clients** — name, phone variants, email
- **Invoices** — invoice number, linked job ref, client name

Results link to job detail, client list filter, or invoice/financials context.

### Shared helpers

- `lib/command-palette/quick-actions.ts` — action catalog + client-side filter
- `lib/command-palette/search.ts` — server search aggregation
- `components/command-palette/CommandPaletteProvider.tsx` — keyboard shortcut, modal UI, provider context

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/command-palette.test.ts
```

Manual:

1. Press **⌘K** (or **Ctrl+K**) on any app page — palette opens.
2. With empty query, quick actions appear for your role.
3. Type a job ref, client phone, or invoice number — matching rows appear; Enter navigates.

---

## Files

| File | Role |
|------|------|
| `lib/command-palette/quick-actions.ts` | Quick action catalog |
| `lib/command-palette/search.ts` | Org-scoped entity search |
| `app/api/command-palette/search/route.ts` | Search API |
| `components/command-palette/CommandPaletteProvider.tsx` | Palette UI + shortcut |
| `app/(app)/layout.tsx` | Provider mount |
| `components/layout/Header.tsx` | Search trigger button |
| `tests/unit/command-palette.test.ts` | Action/filter tests |
