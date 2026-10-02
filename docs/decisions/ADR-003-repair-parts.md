# ADR-003: Repair parts rule (free-text vs inventory-linked)

## Context
Repair jobs have a dual track. `Job.partsNeeded/partsReplaced/workDone/diagnosisNotes String?` (`prisma/schema.prisma:643-651,684-685`) are written by `components/jobs/JobDetailTabs.tsx:1739,1766,1967` with no `Part` linkage. A separate structured path exists: `PartReservation` (`jobId Cascade`, `partId Restrict`) + `PartStockTransaction` ledger via `reserveForJob/consumeReservation` (`lib/inventory-service.ts`, `parts-actions.ts`, `JobPartsPanel.tsx`), plus completion auto-consume from `ACCEPTED QuotationItem.partId` (`lib/inventory/consume-repair-parts.ts:35-45`, skips null `partId`).

## Problem
Free-text parts bypass reservations, consumption, and stock/finance effects. Code comments acknowledge it (`parts-actions.ts` header, `consume-repair-parts.ts` header, `job-invoice-lines.ts`). Retail is closer to readiness than repair for this reason.

## Options Considered
1. Structured-only: require `Part` selection for any part affecting stock/cost; free-text limited to notes with no stock effect.
2. Dual-track formalised: free-text = notes only (never touches stock); structured = the only stock-affecting path; completion consume warns on free-text lines.
3. Status quo (both tracks affect stock via inference): rejected — inference is unsafe.

## Decision
PROPOSED: Option 2, with UI making the distinction explicit (notes vs fitted parts). Option 1 for any part that changes cost charged to client.

## Reasons
- Preserves technician speed (notes) while closing the stock/finance hole.
- Matches existing code direction (idempotent `REPAIR_CONSUME` ledger, `unitCostSnapshot`).

## Consequences
- `JobDetailTabs` diagnosis form must label free-text as non-stock; `JobPartsPanel` becomes the stock path.
- E2E repair test must assert: reserve → consume → `Part.qtyOnHand`/`PartLocationStock` reduced → ledger row → job history.
- `Part.category String?` vs orphan `InventoryCategory` table to be resolved separately (no FK).

## Alternatives Rejected
- Free-text inference to stock: rejected — incorrect by construction.

## Date
2026-09-23

## Status
APPROVED by owner 2026-09-23. Implementation: free-text = notes only; parts panel = stock path; UI distinction explicit.
