# C2 — Stock write-path corruption fix

Status: **core corruption fixed & runtime-verified.** Follow-ons (H1 repair/invoice
consumption) tracked below.

## The defect

`Part.qtyOnHand` (read by every report, dashboard, POS check, low-stock alert) was
being **overwritten with `SUM(PartLocationStock)`** by three paths — PO receive,
stock-count approve, and stock transfer. But manual adjustments and POS sales write
`Part.qtyOnHand` **directly and never create location rows**, so the first
location-based operation on such a part silently wiped all its manual/POS history.

Failure: part seeded to 70 via manual adjust (no location row) → PO receives 5 →
old code set `Part = SUM(location) = 5`, losing 65 units.

## The fix (implemented — no schema change, no data backfill)

`lib/inventory-service.ts` already documents the correct invariant: **`Part.qtyOnHand`
is authoritative and updated by direct increment/decrement; `PartLocationStock` is a
per-location mirror, not the source of truth.** The corruption came entirely from the
three paths that violated this by recomputing `Part` from the location SUM.

Fix = make those three paths obey the invariant:

| Path | File | Change |
|------|------|--------|
| PO receive | `inventory/purchase-orders/actions.ts` | `Part.qtyOnHand { increment: delta }` (was `= SUM(location)`); weighted-avg cost now reads the true `Part.qtyOnHand` |
| Stock count | `inventory/stock-counts/actions.ts` | `Part.qtyOnHand { increment: variance }` (was `= SUM(location)`) |
| Transfer | `inventory/transfers/actions.ts` | removed the `syncPartAggregate` recompute entirely — an intra-org transfer moves stock between locations and must not change the org total |

Manual adjust and POS were already correct (direct increment) and needed no change.

**Why no backfill:** the original plan (make location authoritative + backfill
`PartLocationStock` for existing `qtyOnHand`) is unnecessary once `Part` is authoritative
and never recomputed. Incrementing preserves the existing value regardless of whether a
location row exists, so no live-data migration is required.

## Verification (runtime, against a real Prisma DB)

A throwaway-DB script reproduced the exact corruption scenario and asserted:
- seed `qtyOnHand=70` (no location row)
- PO receive +5 → **75** (not wiped to 5); weighted-avg cost `(70·1000+5·2000)/75 ≈ 1067`
- stock-count +3 → **78**
- confirmed `SUM(location)=8` (the value the old bug would have set)

All assertions passed. `tsc` clean; clean `vercel-build` exit 0.

## Known residual (acceptable, not corruption)

`PartLocationStock` remains a **partial** breakdown for parts touched by manual/POS
(those paths still don't write a location row), so per-location views can understate
such parts. `Part.qtyOnHand` — what everything reads — is correct. Making manual/POS
location-aware (writing to a default location) is an optional enhancement, not required
for correctness; it needs a default-location resolution step.

## Follow-ons (separate work, not part of the corruption fix)

- **H1** — repairs and invoiced goods still don't decrement stock. Wire the existing
  (unused) reservation engine: `reserveForJob` on assignment, `consumeReservation` on
  completion, `releaseReservation` on cancel; decrement part-linked invoice lines on
  finalization. This is a feature addition, not a bug in the write-path.
- **H5** — DONE: the Documents credit-note "mark received" now restores stock like POS.
- **M6** — enrich `PartStockTransaction` (orgId, locationId, unitCost, source ref) —
  additive schema migration, for ledger reconstruction.
