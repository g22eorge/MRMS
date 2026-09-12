import { toBaseAmount } from "@/lib/currency";

/**
 * Landed cost: what a bought item actually cost to get here.
 *
 * Deliberately different from what the books say, and both are right. The
 * ledger treats a transfer charge as a finance cost, so cost of sales stays the
 * cost of the goods and the annual cost of moving money abroad is visible as
 * its own line. Pricing needs the opposite view: an item bought in AED for a
 * shilling business cost the goods, plus the spread on the transfer, plus the
 * bank's charge — and pricing off the invoice value alone quietly sells at a
 * loss on every consignment.
 *
 * This is computed on read and never written back over a stored unit cost.
 * Overwriting Part.unitCost would rewrite the cost of stock already sold, which
 * moves historical margin and makes last quarter's numbers change.
 */

export type LandedCostLine = {
  /** Identifies the line back to its source row. */
  id: string;
  /** Quantity received on this line. */
  quantity: number;
  /** Line value in the document's currency, before any charges. */
  lineTotal: number;
};

export type LandedCostInput = {
  baseCurrency: string;
  /** Currency of the bill these lines belong to. */
  currency: string;
  /** Rate actually settled at; null when the bill is already in base. */
  exchangeRateToBase: number | null;
  /** Transfer charges in base currency, across every payment on the bill. */
  feesBase: number;
  lines: LandedCostLine[];
};

export type LandedCostLineResult = LandedCostLine & {
  /** Line value converted to base, excluding charges. */
  goodsBase: number;
  /** This line's share of the charges. */
  feeShareBase: number;
  /** Goods plus charges, in base. */
  landedBase: number;
  /** Landed cost of one unit, in base. */
  landedUnitBase: number;
};

/**
 * Apportion charges across lines by value, not by quantity or by line count.
 *
 * A transfer fee is paid to move money, so it belongs to the money: a line
 * worth eighty per cent of the consignment carries eighty per cent of the fee.
 * Splitting per unit would load the same charge onto a screw as onto a laptop.
 */
export function landedCost(input: LandedCostInput): {
  lines: LandedCostLineResult[];
  goodsBase: number;
  feesBase: number;
  landedBase: number;
} {
  const toBase = (amount: number) =>
    toBaseAmount({
      amount,
      currency: input.currency,
      baseCurrency: input.baseCurrency,
      exchangeRateToBase: input.exchangeRateToBase,
    });

  const withGoods = input.lines.map((l) => ({ ...l, goodsBase: toBase(l.lineTotal) }));
  const goodsBase = withGoods.reduce((s, l) => s + l.goodsBase, 0);
  const feesBase = Number.isFinite(input.feesBase) && input.feesBase > 0 ? input.feesBase : 0;

  const lines: LandedCostLineResult[] = withGoods.map((l) => {
    // A zero-value consignment cannot apportion by value; with nothing to
    // weight by, the charge is spread evenly rather than dropped.
    const share =
      goodsBase > 0
        ? (l.goodsBase / goodsBase) * feesBase
        : withGoods.length > 0
          ? feesBase / withGoods.length
          : 0;
    const landedBase = l.goodsBase + share;
    return {
      ...l,
      feeShareBase: share,
      landedBase,
      landedUnitBase: l.quantity > 0 ? landedBase / l.quantity : landedBase,
    };
  });

  return { lines, goodsBase, feesBase, landedBase: goodsBase + feesBase };
}
