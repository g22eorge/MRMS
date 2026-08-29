import { describe, it, expect } from "bun:test";

import { landedCost } from "../../lib/inventory/landed-cost";

const BASE = "UGX";

describe("landed cost", () => {
  it("converts the goods and adds the charges", () => {
    // AED 1,000 of goods settled at 3,850, plus a UGX 30,000 transfer charge.
    const r = landedCost({
      baseCurrency: BASE,
      currency: "AED",
      exchangeRateToBase: 3850,
      feesBase: 30_000,
      lines: [{ id: "a", quantity: 10, lineTotal: 1000 }],
    });
    expect(r.goodsBase).toBe(3_850_000);
    expect(r.landedBase).toBe(3_880_000);
    expect(r.lines[0].landedUnitBase).toBe(388_000);
  });

  it("apportions charges by value, not by line or by unit", () => {
    // The fee is paid to move money, so it belongs to the money. Splitting per
    // unit would load the same charge onto a screw as onto a laptop.
    const r = landedCost({
      baseCurrency: BASE,
      currency: "USD",
      exchangeRateToBase: 3750,
      feesBase: 100_000,
      lines: [
        { id: "big", quantity: 1, lineTotal: 800 },
        { id: "small", quantity: 100, lineTotal: 200 },
      ],
    });
    expect(r.lines[0].feeShareBase).toBeCloseTo(80_000, 6);
    expect(r.lines[1].feeShareBase).toBeCloseTo(20_000, 6);
    // Per unit the cheap line barely moves; the expensive one carries the cost.
    expect(r.lines[0].landedUnitBase).toBeGreaterThan(r.lines[1].landedUnitBase);
  });

  it("leaves a base-currency bill's goods value untouched", () => {
    const r = landedCost({
      baseCurrency: BASE,
      currency: BASE,
      exchangeRateToBase: null,
      feesBase: 5_000,
      lines: [{ id: "a", quantity: 2, lineTotal: 100_000 }],
    });
    expect(r.goodsBase).toBe(100_000);
    expect(r.landedBase).toBe(105_000);
  });

  it("adds nothing when there were no charges", () => {
    const r = landedCost({
      baseCurrency: BASE, currency: BASE, exchangeRateToBase: null, feesBase: 0,
      lines: [{ id: "a", quantity: 4, lineTotal: 40_000 }],
    });
    expect(r.landedBase).toBe(40_000);
    expect(r.lines[0].landedUnitBase).toBe(10_000);
  });

  it("spreads charges evenly when there is no value to weight by", () => {
    // A zero-value consignment still cost money to pay for. Dropping the charge
    // would understate it; dividing by zero would produce NaN and poison every
    // total downstream.
    const r = landedCost({
      baseCurrency: BASE, currency: BASE, exchangeRateToBase: null, feesBase: 9_000,
      lines: [{ id: "a", quantity: 1, lineTotal: 0 }, { id: "b", quantity: 1, lineTotal: 0 }],
    });
    expect(r.lines[0].feeShareBase).toBe(4_500);
    expect(r.lines[1].feeShareBase).toBe(4_500);
    expect(Number.isNaN(r.landedBase)).toBe(false);
  });

  it("does not divide by a zero quantity", () => {
    const r = landedCost({
      baseCurrency: BASE, currency: BASE, exchangeRateToBase: null, feesBase: 1_000,
      lines: [{ id: "a", quantity: 0, lineTotal: 5_000 }],
    });
    expect(Number.isFinite(r.lines[0].landedUnitBase)).toBe(true);
  });

  it("scores an unconvertible foreign bill as zero goods rather than face value", () => {
    // Same rule as everywhere else: visibly wrong beats plausibly wrong. A USD
    // 1,000 bill must not enter a shilling cost as 1,000.
    const r = landedCost({
      baseCurrency: BASE, currency: "USD", exchangeRateToBase: null, feesBase: 0,
      lines: [{ id: "a", quantity: 1, lineTotal: 1000 }],
    });
    expect(r.goodsBase).toBe(0);
  });

  it("keeps the total equal to goods plus charges", () => {
    const r = landedCost({
      baseCurrency: BASE, currency: "RMB", exchangeRateToBase: 520, feesBase: 44_000,
      lines: [
        { id: "a", quantity: 3, lineTotal: 900 },
        { id: "b", quantity: 7, lineTotal: 1500 },
        { id: "c", quantity: 2, lineTotal: 600 },
      ],
    });
    const summed = r.lines.reduce((s, l) => s + l.landedBase, 0);
    expect(summed).toBeCloseTo(r.landedBase, 6);
    expect(r.landedBase).toBeCloseTo(r.goodsBase + r.feesBase, 6);
  });
});
