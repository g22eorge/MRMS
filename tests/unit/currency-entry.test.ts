import { describe, it, expect } from "bun:test";

import {
  effectiveRateFromSettlement,
  ratePremiumPct,
  readCurrencyAndRate,
  rowToBase,
  toBaseAmount,
} from "../../lib/currency";

const BASE = "UGX";

describe("readCurrencyAndRate", () => {
  it("stores no rate for a document in the organisation's own currency", () => {
    // Null and 1 must not both mean "base", or every reader carries two cases
    // forever and one of them eventually gets forgotten.
    const r = readCurrencyAndRate({ currency: "UGX", exchangeRate: "1", baseCurrency: BASE });
    expect(r).toEqual({ currency: "UGX", exchangeRateToBase: null });
  });

  it("discards a rate submitted alongside the base currency", () => {
    const r = readCurrencyAndRate({ currency: "UGX", exchangeRate: "3750", baseCurrency: BASE });
    expect(r.exchangeRateToBase).toBeNull();
    expect(r.error).toBeUndefined();
  });

  it("keeps the rate for a foreign document", () => {
    const r = readCurrencyAndRate({ currency: "USD", exchangeRate: "3750", baseCurrency: BASE });
    expect(r).toEqual({ currency: "USD", exchangeRateToBase: 3750 });
  });

  it("accepts a rate typed with thousands separators", () => {
    // People type what they say. "3,750" must not be read as 3.
    expect(readCurrencyAndRate({ currency: "USD", exchangeRate: "3,750", baseCurrency: BASE }).exchangeRateToBase).toBe(3750);
  });

  it("refuses a foreign document with no rate, and says what to enter", () => {
    const r = readCurrencyAndRate({ currency: "USD", exchangeRate: "", baseCurrency: BASE });
    expect(r.exchangeRateToBase).toBeNull();
    expect(r.error).toContain("how many UGX to 1 USD");
  });

  it("refuses a rate that is zero, negative or not a number", () => {
    for (const bad of ["0", "-5", "abc"]) {
      expect(readCurrencyAndRate({ currency: "USD", exchangeRate: bad, baseCurrency: BASE }).error).toBeTruthy();
    }
  });

  it("refuses a currency the system does not support", () => {
    expect(readCurrencyAndRate({ currency: "XYZ", exchangeRate: "2", baseCurrency: BASE }).error).toContain("not a supported currency");
  });

  it("treats a missing currency as the organisation's own", () => {
    expect(readCurrencyAndRate({ currency: null, exchangeRate: null, baseCurrency: BASE })).toEqual({
      currency: "UGX", exchangeRateToBase: null,
    });
  });

  it("works for an organisation whose base is not UGX", () => {
    // The whole point of the column: a Kenyan tenant quoting in dollars.
    const r = readCurrencyAndRate({ currency: "USD", exchangeRate: "129.5", baseCurrency: "KES" });
    expect(r).toEqual({ currency: "USD", exchangeRateToBase: 129.5 });
    expect(readCurrencyAndRate({ currency: "KES", exchangeRate: "", baseCurrency: "KES" }).error).toBeUndefined();
  });
});

describe("rowToBase", () => {
  it("passes a base-currency row through untouched", () => {
    expect(rowToBase({ amount: 500_000, currency: "UGX", exchangeRateToBase: null }, BASE)).toBe(500_000);
  });

  it("converts a foreign row at its own stored rate", () => {
    expect(rowToBase({ amount: 100, currency: "USD", exchangeRateToBase: 3750 }, BASE)).toBe(375_000);
  });

  it("scores an unconvertible foreign row as zero rather than as its face value", () => {
    // This is the behaviour the whole build exists to prevent reaching a total:
    // adding USD 100 to a shilling column as "100" understates by ~3,750x and
    // looks entirely plausible. Zero is wrong too, but it is visibly wrong.
    expect(rowToBase({ amount: 100, currency: "USD", exchangeRateToBase: null }, BASE)).toBe(0);
  });

  it("treats a row with no currency as base, which is what old rows are", () => {
    expect(rowToBase({ amount: 250, currency: null, exchangeRateToBase: null }, BASE)).toBe(250);
  });

  it("agrees with toBaseAmount, which it wraps", () => {
    const row = { amount: 42, currency: "EUR", exchangeRateToBase: 4100 };
    expect(rowToBase(row, BASE)).toBe(
      toBaseAmount({ amount: 42, currency: "EUR", baseCurrency: BASE, exchangeRateToBase: 4100 }),
    );
  });
});

describe("effectiveRateFromSettlement", () => {
  it("derives the rate a transfer was actually settled at", () => {
    // Sent 3,880,000 UGX, of which 30,000 was charges; supplier credited AED
    // 1,000. The rate that matters is 3,850 — it carries the bureau's spread
    // without anyone having to know what the spread was.
    expect(effectiveRateFromSettlement({ amount: 1000, baseAmountSent: 3_880_000, feeAmount: 30_000 })).toBe(3850);
  });

  it("treats the fee as part of what was sent, not on top of it", () => {
    // If the fee were added rather than carved out, the derived rate would be
    // too high and every landed cost with it.
    const withFee = effectiveRateFromSettlement({ amount: 1000, baseAmountSent: 3_880_000, feeAmount: 30_000 })!;
    const withoutFee = effectiveRateFromSettlement({ amount: 1000, baseAmountSent: 3_880_000, feeAmount: 0 })!;
    expect(withFee).toBeLessThan(withoutFee);
    expect(withoutFee).toBe(3880);
  });

  it("works with no fee recorded", () => {
    expect(effectiveRateFromSettlement({ amount: 100, baseAmountSent: 385_000 })).toBe(3850);
  });

  it("returns null rather than a wrong rate when it cannot be derived", () => {
    // A caller must keep the hand-entered rate in these cases, not overwrite it.
    expect(effectiveRateFromSettlement({ amount: 0, baseAmountSent: 100 })).toBeNull();
    expect(effectiveRateFromSettlement({ amount: 100, baseAmountSent: null })).toBeNull();
    expect(effectiveRateFromSettlement({ amount: 100, baseAmountSent: 50, feeAmount: 80 })).toBeNull();
  });
});

describe("ratePremiumPct", () => {
  it("says how far a settlement sat above a reference rate", () => {
    expect(ratePremiumPct(3850, 3700)).toBeCloseTo(4.054, 2);
  });

  it("goes negative when the settlement beat the reference", () => {
    expect(ratePremiumPct(3600, 3700)!).toBeLessThan(0);
  });

  it("refuses nonsense instead of returning Infinity", () => {
    expect(ratePremiumPct(3850, 0)).toBeNull();
    expect(ratePremiumPct(0, 3700)).toBeNull();
  });
});
