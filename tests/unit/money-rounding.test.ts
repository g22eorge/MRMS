/**
 * ADR-001 — Money rounding discipline (Option 1: rounding + tests).
 *
 * Locks in the contract of roundMoney/toBaseAmount in lib/currency.ts and
 * documents the one place float dust can still strand a document: the raw
 * accumulation in sumInvoicePaidAmount/sumSalePaidAmount
 * (lib/commercial/payment-sync.ts), where neither side of the paid/total
 * comparison is rounded. That follow-up (round the sums) is tracked as P1-02;
 * these tests prove the helper that follow-up will use.
 */

import { describe, it, expect } from "bun:test";

import { currencyDecimals, roundMoney, toBaseAmount } from "../../lib/currency";

describe("currencyDecimals()", () => {
  it("gives 0 for zero-decimal currencies", () => {
    expect(currencyDecimals("UGX")).toBe(0);
    expect(currencyDecimals("ugx")).toBe(0);
    expect(currencyDecimals("JPY")).toBe(0);
  });

  it("gives 2 for standard currencies", () => {
    expect(currencyDecimals("USD")).toBe(2);
    expect(currencyDecimals("KES")).toBe(2);
  });
});

describe("roundMoney()", () => {
  it("rounds UGX to whole shillings so a total stays payable", () => {
    expect(roundMoney(29653.4, "UGX")).toBe(29653);
    expect(roundMoney(29653.5, "UGX")).toBe(29654);
  });

  it("rounds USD to cents, including the 1.005 midpoint", () => {
    expect(roundMoney(10.004, "USD")).toBe(10);
    expect(roundMoney(10.005, "USD")).toBe(10.01);
  });

  it("repairs the classic 0.1 + 0.2 float trap", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(roundMoney(0.1 + 0.2, "USD")).toBe(0.3);
  });

  it("maps non-finite input to 0 instead of poisoning totals", () => {
    expect(roundMoney(NaN, "USD")).toBe(0);
    expect(roundMoney(Infinity, "UGX")).toBe(0);
  });
});

describe("toBaseAmount() + roundMoney() FX netting", () => {
  const RATE = 3750.55; // fractional rate — where float dust actually bites
  const toUgx = (amount: number) =>
    toBaseAmount({ amount, currency: "USD", baseCurrency: "UGX", exchangeRateToBase: RATE });

  it("converts foreign amounts to base without inventing a rate", () => {
    expect(toBaseAmount({ amount: 10, currency: "USD", baseCurrency: "UGX", exchangeRateToBase: 3700 })).toBe(
      37000,
    );
    expect(
      toBaseAmount({ amount: 10, currency: "USD", baseCurrency: "UGX", exchangeRateToBase: null }),
    ).toBe(0);
  });

  it("split FX sums net to the invoiced total once rounded, never raw", () => {
    // Raw float sums must never be compared with === (engine-sensitive dust:
    // the same expression can be exact under FMA contraction and off by an ulp
    // elsewhere — the 0.1 + 0.2 case above is the portable proof). The paid/total
    // comparison in payment-sync.ts is therefore a P1-02 follow-up: round both
    // sides (or allow a sub-unit tolerance) instead of comparing raw sums.
    const twoWay = toUgx(0.1) + toUgx(0.2);
    expect(roundMoney(twoWay, "UGX")).toBe(roundMoney(0.3 * RATE, "UGX"));

    const threeWay = toUgx(19.99) + toUgx(19.99) + toUgx(60.03);
    expect(roundMoney(threeWay, "UGX")).toBe(roundMoney(toUgx(100.01), "UGX"));
  });
});
