# Fix 4.6 — Standard loading/empty/not-found/error contract

**Phase:** 4 (workflow)  
**Source:** [`system-analysis.md`](../system-analysis.md) FLOW-6 / Phase 4 item 6  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Pages handled async states inconsistently: duplicated error/not-found markup, generic table empty rows without CTAs, and detail headers that showed misleading subtitles (e.g. "Ref board") before a 404 resolved.

---

## Change

### Shared page-state kit (`components/page-state/`)

| Component | Purpose |
|-----------|---------|
| `PageLoadingState` | Skeleton variants: `default`, `list`, `detail`, `table` |
| `PageEmptyState` | Empty panel, dashed CTA panel, or table row |
| `PageNotFoundState` | Standard 404 card with primary/secondary links |
| `PageErrorState` | Error card with **Retry** + back link |
| `PageStatePanel` | Shared shell for not-found/error panels |

Contract types live in `lib/page-state/contract.ts`.

### Wired boundaries

- App `error.tsx` / `not-found.tsx` use shared components
- `documents/error.tsx` uses `PageErrorState`
- New `jobs/[id]/not-found.tsx`, `jobs/[id]/error.tsx`
- New `clients/[id]/not-found.tsx`
- List/detail loading routes use appropriate skeleton variants
- `DocumentEmptyState` delegates to `PageEmptyState`
- `PageThemeHeader` only resolves subtitles for valid record ids (fixes "Ref board" on invalid paths)

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/page-state.test.ts
```

Manual:

1. Visit `/jobs/board` or an invalid job id → not-found card, no bogus header subtitle.
2. Trigger a documents error boundary → Retry works.
3. Empty document lists still render with consistent empty panels.

---

## Files

| File | Role |
|------|------|
| `lib/page-state/contract.ts` | State kinds + record-id helper |
| `components/page-state/*` | Shared UI kit |
| `app/(app)/error.tsx`, `not-found.tsx` | App boundaries |
| `app/(app)/jobs/[id]/not-found.tsx`, `error.tsx` | Job detail boundaries |
| `app/(app)/clients/[id]/not-found.tsx` | Client detail boundary |
| `components/documents/DocumentEmptyState.tsx` | Empty state adapter |
| `components/layout/PageThemeHeader.tsx` | Subtitle guard |
| `tests/unit/page-state.test.ts` | Contract tests |
