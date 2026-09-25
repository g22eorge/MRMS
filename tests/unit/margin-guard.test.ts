/**
 * Below-cost guard arithmetic (lib/commercial/margin-guard.ts). Pure
 * functions — the rejection itself is tested end-to-end by the sales specs.
 */
import { describe, it, expect } from "bun:test";

import {
  costPerSaleUnit,
  effectiveUnitPrice,
  isBelowCost,
  jobBillBelowCost,
  lineMarginPct,
} from "../../lib/commercial/margin-guard";

describe("effectiveUnitPrice()", () => {
  it("passes through without discount", () => {
    expect(effectiveUnitPrice(1000)).toBe(1000);
    expect(effectiveUnitPrice(1000, 0)).toBe(1000);
  });

  it("applies the line discount", () => {
    expect(effectiveUnitPrice(1000, 10)).toBe(900);
    expect(effectiveUnitPrice(1000, 100)).toBe(0);
  });
});

describe("costPerSaleUnit()", () => {
  it("returns null with no cost basis (skip check)", () => {
    expect(costPerSaleUnit(null)).toBeNull();
    expect(costPerSaleUnit(undefined)).toBeNull();
    expect(costPerSaleUnit(0)).toBeNull();
  });

  it("scales by the UOM factor", () => {
    expect(costPerSaleUnit(500, 2)).toBe(1000);
    expect(costPerSaleUnit(500, null)).toBe(500);
  });
});

describe("isBelowCost()", () => {
  it("flags price under cost, including via discount", () => {
    expect(isBelowCost({ unitPrice: 900, unitCost: 1000 })).toBe(true);
    expect(isBelowCost({ unitPrice: 1000, discountPct: 20, unitCost: 900 })).toBe(true);
  });

  it("passes at or above cost", () => {
    expect(isBelowCost({ unitPrice: 1000, unitCost: 1000 })).toBe(false);
    expect(isBelowCost({ unitPrice: 1200, discountPct: 10, unitCost: 1000 })).toBe(false);
  });

  it("skips unknown cost and non-finite prices", () => {
    expect(isBelowCost({ unitPrice: 0, unitCost: null })).toBe(false);
    expect(isBelowCost({ unitPrice: NaN, unitCost: 1000 })).toBe(false);
  });
});

describe("lineMarginPct()", () => {
  it("computes margin on price", () => {
    expect(lineMarginPct({ unitPrice: 1000, unitCost: 600 })).toBeCloseTo(40, 10);
  });

  it("returns null without a basis", () => {
    expect(lineMarginPct({ unitPrice: 1000, unitCost: null })).toBeNull();
    expect(lineMarginPct({ unitPrice: 0, unitCost: 600 })).toBeNull();
  });
});

describe("jobBillBelowCost()", () => {
  it("flags a bill under the fee override, else the submitted bill", () => {
    expect(jobBillBelowCost({ clientBill: 70000, externalTechFee: 80000, externalTechBill: 60000 })).toBe(true);
    expect(jobBillBelowCost({ clientBill: 70000, externalTechFee: null, externalTechBill: 80000 })).toBe(true);
  });

  it("passes at/above cost and with no recorded cost (in-house)", () => {
    expect(jobBillBelowCost({ clientBill: 80000, externalTechFee: 80000, externalTechBill: null })).toBe(false);
    expect(jobBillBelowCost({ clientBill: 50000, externalTechFee: null, externalTechBill: null })).toBe(false);
    expect(jobBillBelowCost({ clientBill: null, externalTechFee: 80000, externalTechBill: null })).toBe(false);
  });
});
