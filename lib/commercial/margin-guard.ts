/**
 * Below-cost guard shared by quotation creation and the POS till.
 *
 * Selling below cost is a certain loss, so part-linked lines are rejected when
 * the effective price (after line discount) drops below the part's cost.
 * Custom (non-part) lines carry no cost basis and are unaffected — gifts and
 * comps go through those. Unknown/zero cost skips the check (matches the
 * existing noCostItems advisory rather than blocking on missing data).
 *
 * Pure functions so unit tests pin the arithmetic; callers own their error
 * channels (throw vs posReject with redirect).
 */

/** Price actually charged per sale unit after the line discount. */
export function effectiveUnitPrice(unitPrice: number, discountPct?: number | null): number {
  const discount = Number(discountPct) || 0;
  if (!(discount > 0)) return unitPrice;
  return unitPrice * (1 - Math.min(discount, 100) / 100);
}

/** Cost per sale unit, or null when there is no basis to judge (skip check). */
export function costPerSaleUnit(
  unitCost: number | null | undefined,
  saleUomFactor?: number | null,
): number | null {
  if (unitCost == null || !(unitCost > 0)) return null;
  const factor = Number(saleUomFactor);
  return unitCost * (Number.isFinite(factor) && factor > 0 ? factor : 1);
}

/** True when a part-linked line would sell below cost. */
export function isBelowCost(params: {
  unitPrice: number;
  discountPct?: number | null;
  unitCost: number | null | undefined;
  saleUomFactor?: number | null;
}): boolean {
  const cost = costPerSaleUnit(params.unitCost, params.saleUomFactor);
  if (cost == null) return false;
  if (!Number.isFinite(params.unitPrice)) return false;
  return effectiveUnitPrice(params.unitPrice, params.discountPct) < cost;
}

/** Gross margin of a line as a percentage of price (for messages/reports). */
export function lineMarginPct(params: {
  unitPrice: number;
  discountPct?: number | null;
  unitCost: number | null | undefined;
  saleUomFactor?: number | null;
}): number | null {
  const cost = costPerSaleUnit(params.unitCost, params.saleUomFactor);
  const price = effectiveUnitPrice(params.unitPrice, params.discountPct);
  if (cost == null || !(price > 0)) return null;
  return ((price - cost) / price) * 100;
}

/**
 * Repair-job completion guard: the final client bill must cover the
 * technician cost (fee override wins, else the submitted bill — the same
 * definition the Repair Margin export reports). In-house jobs record no tech
 * cost, so there is nothing to guard and this returns false.
 */
export function jobBillBelowCost(params: {
  clientBill: number | null | undefined;
  externalTechFee: number | null | undefined;
  externalTechBill: number | null | undefined;
}): boolean {
  const raw = params.clientBill;
  if (raw == null) return false;
  const bill = Number(raw);
  if (!Number.isFinite(bill)) return false;
  const fee = Number(params.externalTechFee);
  const submitted = Number(params.externalTechBill);
  const cost = Number.isFinite(fee) && fee > 0 ? fee : Number.isFinite(submitted) && submitted > 0 ? submitted : 0;
  if (!(cost > 0)) return false;
  return bill < cost;
}
