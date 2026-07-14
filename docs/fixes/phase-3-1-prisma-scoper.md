# Fix 3.1 — Prisma org scoper consolidation

**Phase:** 3 (structural)  
**Source:** [`system-analysis.md`](../system-analysis.md) P0 dual scopers / Phase 3 item 1  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Two org-scoped Prisma helpers diverged:

| Helper | Location | Behavior |
|--------|----------|----------|
| `orgDb` | `lib/prisma.ts` | `$allOperations` injected `orgId` on reads including `findUnique` (invalid for unique constraints) |
| `scopedDb` | `lib/prisma-scope.ts` | Per-operation hooks, `findUnique` post-validation, soft-delete filter — **zero production imports** |

Model lists differed (~30 vs ~60 models). Finance/CRM models (`Campaign`, `ChartOfAccount`, `BankAccount`, etc.) were only in `orgDb`.

---

## Change

### New: `lib/org-scoped-models.ts`

Single `ORG_SCOPED_MODELS` set derived from schema models with a direct `orgId` column (82 models). `SOFT_DELETE_MODELS` aligned to schema (`FileAsset` only).

### New: `lib/db.ts`

Canonical entry point:

- `scopedDb(orgId)` — preferred
- `orgDb(orgId)` — alias (same implementation)
- `scopedDbFromSession`, `ScopedDb` type

### Updated: `lib/prisma-scope.ts`

Uses shared model lists; added `createMany` / `createManyAndReturn` orgId injection for parity with old `orgDb`.

### Removed: duplicate `orgDb` from `lib/prisma.ts`

All former `import { orgDb } from "@/lib/prisma"` call sites now import from `@/lib/db`.

### QA

- `tests/unit/org-scoped-db.test.ts` — findMany isolation, cross-org findUnique, create injection, alias parity
- `scripts/qa-tenant-scoping.mjs` — ORM-layer smoke test

---

## Verification

```bash
pnpm exec tsc --noEmit
bun test tests/unit/org-scoped-db.test.ts
bun scripts/qa-tenant-scoping.mjs
```

Manual: finance/campaigns/clients pages still load under a normal org session; no cross-org data in lists.

---

## Next

Phase 3.2: `components/documents/` kit — migrate receipts + delivery-notes first.
