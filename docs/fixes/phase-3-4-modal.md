# Fix 3.4 — Shared Modal component

**Phase:** 3 (structural)  
**Source:** [`system-analysis.md`](../system-analysis.md) UX-14 / Phase 3 item 4  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Four dialogs hand-rolled the same overlay, backdrop click, Escape handling, and panel shell (`fixed inset-0 z-50`, `role="dialog"`, `aria-modal`). Behavior drifted (e.g. credit note lacked Escape; backdrop markup differed).

---

## Change

### New: `components/ui/Modal.tsx`

| Export | Purpose |
|--------|---------|
| `Modal` | Overlay, backdrop, Escape close, size variants |
| `ModalHeader` | Title, optional subtitle, close button |
| `ModalCloseButton` | Shared dismiss control |

### New: `lib/ui/modal.ts`

Pure `modalPanelClassName()` helper and `ModalSize` type for tests and reuse.

### Migrated dialogs

- `components/shared/ConfirmDialog.tsx`
- `app/(app)/documents/receipts/CreateReceiptDialog.tsx`
- `app/(app)/documents/credit-notes/CreateCreditNoteDialog.tsx`
- `app/(app)/targets/SetTargetDialog.tsx`

All four now share Escape-to-close, backdrop dismiss, and consistent panel sizing (`sm` / `md` / `lg` / `xl`).

### Test

`tests/unit/modal.test.ts`

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/modal.test.ts
```

Manual: open each dialog — Escape and backdrop close work; focus stays in dialog shell; confirm actions still submit.

---

## Next

Phase 3.5: Consolidate `/platform` + `/platform-admin`.
