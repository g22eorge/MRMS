# Fix 1.5 — Remove dead code + dedupe settings profile form

**Phase:** 1 (safe, high ROI)  
**Source:** [`system-analysis.md`](../system-analysis.md) finding 15 / Phase 1 item 5  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Four low-risk cleanup items accumulated duplicate or unused code:

| Item | Location | Issue |
|------|----------|-------|
| `writePaymentAccountingDocuments` | `lib/commercial/accounting.ts` | Never called; canonical payment receipt path is `createReceiptForPayment()` in `document-workflow.ts` |
| `orgWhere` | `lib/org-context.ts` | Exported helper never imported; pages use `orgDb()` instead |
| `SettingsPageHeader` | `components/settings/SettingsPageHeader.tsx` | Component defined but never imported |
| Profile form | `SettingsPanel` vs `ProfileForm` | ~30 lines duplicated name/phone/email/role fields and save action |

Keeping unused receipt-writing code risked a future contributor wiring payments through a second, divergent path.

---

## Change

### Removed dead code

- Deleted `writePaymentAccountingDocuments()` and its unused `nextDocumentNumber` import from `lib/commercial/accounting.ts`
- Removed unused `orgWhere()` from `lib/org-context.ts`
- Deleted `components/settings/SettingsPageHeader.tsx`

### Profile form dedupe

- Extended `ProfileForm` with `variant="page" | "compact"` and optional `footerHint`
- **Page variant** (default): full card layout, inline success/error — used by `/settings/profile`
- **Compact variant**: drawer styling, Sonner toasts, `sp-*` field ids — used by settings slide-over panel
- `SettingsPanel` now renders `<ProfileForm variant="compact" … />` instead of an inline duplicate form

Password and admin password reset forms remain in `SettingsPanel` (not duplicated in `ProfileForm`).

---

## Verification

```bash
pnpm exec tsc --noEmit
```

Manual: open settings drawer → Your Profile → save name/phone; confirm toast and refresh. Open `/settings/profile` → confirm full-page form still works.

---

## Next

Phase 2 (from `system-analysis.md`): consolidate business metrics, payment sync, share-document, phone helpers, and route PDF WhatsApp sends through the outbox.
