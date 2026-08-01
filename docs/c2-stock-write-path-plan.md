# C2 — Unify the stock write-path (implementation plan)

Status: **planned, not yet implemented.** This is the most invasive change in the
audit — it touches live inventory data and needs a one-time backfill — so it is
staged deliberately and gated on lower-environment verification.

## The defect (recap)

Two stock quantities are maintained by different code that overwrites each other:

- `Part.qtyOnHand` — read by every report, dashboard, POS availability check, and
  low-stock alert.
- `PartLocationStock.qtyOnHand` — per-location balances used by PO receiving,
  transfers, and stock counts.

Three inconsistent write styles exist today:

| Path | File | Style |
|------|------|-------|
| PO receive | `app/(app)/inventory/purchase-orders/actions.ts:298-327` | upsert location, then `Part.qtyOnHand = SUM(location)` |
| Stock count approve | `app/(app)/inventory/stock-counts/actions.ts:131-132` | upsert location, then `Part.qtyOnHand = SUM(location)` |
| Transfer | `app/(app)/inventory/transfers/actions.ts:123-167` | update both locations, recompute Part |
| Manual adjust | `app/(app)/inventory/actions.ts:135` | `Part.qtyOnHand += delta` — **no location write** |
| POS sale / delete / credit-return | `app/(app)/pos/[id]/page.tsx` | `Part.qtyOnHand ±` — **no location write** |
| Canonical service (unused) | `lib/inventory-service.ts` | increments **both** in lockstep |

Failure: a part seeded via manual adjust (only `Part.qtyOnHand`, no location row)
gets its `qtyOnHand` overwritten to `SUM(location)` on the first PO receive /
count / transfer — silently erasing all prior manual + POS movements.

`lib/inventory-service.ts` already implements the correct lockstep writes and the
negative-stock guards, but **nothing in `app/` calls it** (only tests do).

## Target design

Single source of truth: **`PartLocationStock` is authoritative; `Part.qtyOnHand`
is a derived cache** kept in lockstep on every write. Every mutation goes through
`lib/inventory-service.ts`, which already:

- upserts the location row with a signed delta, and
- increments/decrements `Part.qtyOnHand` by the same delta (no `SUM` recompute),
- writes a `PartStockTransaction` ledger row,
- enforces the negative-stock guard against available (`qtyOnHand - qtyReserved`).

## Phased implementation

### Phase 0 — Prerequisites (no behaviour change)
1. Add `orgId` + `locationId` + `unitCost` + a source ref to `PartStockTransaction`
   (finding M6). *Schema migration — additive columns, low risk.* Needed so the
   ledger can reconstruct movements per location.
2. Give every part a default location. Confirm a `StockLocation` marked default
   per org (or create "Main"). New parts already need an opening-balance path
   (finding M8/opening-balance helper `lib/commercial/inventory.ts` is currently
   dead) — wire `syncDefaultLocationStock` on part create.

### Phase 1 — Backfill (the risky, one-time data step)
For every active `Part` with `qtyOnHand > 0` and **no** `PartLocationStock` rows,
create a `PartLocationStock` row at the org's default location with
`qtyOnHand = Part.qtyOnHand`. After backfill, `SUM(location) == Part.qtyOnHand`
for every part — so the recompute-from-aggregate style becomes safe and the two
systems are reconciled.

- Write as an idempotent script (`scripts/backfill-part-location-stock.mjs`),
  runnable per org.
- **Verify in a copy of production first.** Assert, before and after, that
  `Part.qtyOnHand` is unchanged for every part and that every part now has
  `SUM(PartLocationStock) == Part.qtyOnHand`.
- Run inside a transaction per org; log every row written; support a `--dry-run`.

### Phase 2 — Cutover (route all writes through the service)
Replace the ad-hoc blocks with `inventory-service` calls, one path per PR:
1. Manual adjust (`inventory/actions.ts`) → `applyAdjustment` (writes both tables).
2. POS sale add/delete/credit-return (`pos/[id]/page.tsx`) → `issueStock` /
   `receiveStock`. Also wires the location so POS stops being location-blind.
3. PO receive → `receiveStock` (increment, not `SUM`-recompute).
4. Stock count approve → `applyAdjustment`.
5. Transfers → `issueStock` + `receiveStock` across the two locations.

After every path is on the service, delete the `Part.qtyOnHand = SUM(location)`
recompute lines — they are no longer needed and were the corruption vector.

### Phase 3 — Dependent fixes unlocked
Once the write-path is unified, these fall out cheaply:
- **H1** — repair parts consume stock: call `reserveForJob` on assignment,
  `consumeReservation` on completion, `releaseReservation` on cancel.
- **H1 (invoice goods)** — decrement part-linked invoice lines on finalization.
- **H5** — the Documents credit-note "mark received" restores stock via the same
  service call the POS path uses.
- **M2** — resolved by construction (POS/manual now write location rows).
- **L5** — availability checks use `qtyOnHand - qtyReserved` (the service already does).

## Verification gate (every PR)
- `bunx tsc --noEmit`, `bun run lint`, `bun run vercel-build`.
- `bun run qa:data-integrity` and `bun run qa:concurrency` after Phase 2.
- A reconciliation assertion: for a sample org, `SUM(PartLocationStock) ==
  Part.qtyOnHand` for every active part, before and after each cutover PR.

## Rollback
Phases 2–3 are pure code (revertable by PR). Phase 1 is data: keep the pre-backfill
`Part.qtyOnHand` snapshot so the location rows can be recomputed or removed. Do not
delete the recompute lines (Phase 2 final step) until the backfill is verified in
production.
