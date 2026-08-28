import { describe, it, expect } from "bun:test";

import { amountInWords, numberToWords } from "../../lib/amount-in-words";

describe("numberToWords", () => {
  it("handles the small cases each rule branches on", () => {
    expect(numberToWords(0)).toBe("Zero");
    expect(numberToWords(7)).toBe("Seven");
    expect(numberToWords(13)).toBe("Thirteen");
    expect(numberToWords(20)).toBe("Twenty");
    expect(numberToWords(21)).toBe("Twenty-One");
    expect(numberToWords(99)).toBe("Ninety-Nine");
  });

  it("joins hundreds with 'and', the way the amount is read aloud", () => {
    expect(numberToWords(100)).toBe("One Hundred");
    expect(numberToWords(101)).toBe("One Hundred and One");
    expect(numberToWords(345)).toBe("Three Hundred and Forty-Five");
  });

  it("carries each three-digit group with its own scale", () => {
    expect(numberToWords(1000)).toBe("One Thousand");
    expect(numberToWords(400000)).toBe("Four Hundred Thousand");
    expect(numberToWords(708000)).toBe("Seven Hundred and Eight Thousand");
    expect(numberToWords(1000000)).toBe("One Million");
    expect(numberToWords(2246000)).toBe("Two Million Two Hundred and Forty-Six Thousand");
  });

  it("skips empty groups instead of naming them", () => {
    // "One Million Zero Thousand Five" is the classic bug here.
    expect(numberToWords(1000005)).toBe("One Million Five");
    expect(numberToWords(1000500)).toBe("One Million Five Hundred");
  });

  it("does not lose the last group to a zero above it", () => {
    expect(numberToWords(1_000_000_000)).toBe("One Billion");
    expect(numberToWords(1_002_000_003)).toBe("One Billion Two Million Three");
  });
});

describe("amountInWords", () => {
  it("names the currency and closes with Only", () => {
    expect(amountInWords(400000, "UGX")).toBe("Ugandan Shillings Four Hundred Thousand Only");
  });

  it("omits minor units when there are none", () => {
    // UGX has no circulating subunit; "and Zero Cents" on every receipt is noise.
    expect(amountInWords(600000, "UGX")).not.toContain("Cents");
  });

  it("includes minor units when the amount actually has them", () => {
    expect(amountInWords(12.5, "USD")).toBe("US Dollars Twelve and Fifty Cents Only");
  });

  it("rounds the minor unit the way the figure beside it rounds", () => {
    expect(amountInWords(12.994, "USD")).toBe("US Dollars Twelve and Ninety-Nine Cents Only");
  });

  it("carries a rounded-up minor unit into the major one", () => {
    // 12.999 gives whole 12 and minor 100, which must not print "and 100 Cents".
    expect(amountInWords(12.999, "USD")).toBe("US Dollars Thirteen Only");
  });

  it("keeps an unknown currency's code rather than inventing a name", () => {
    expect(amountInWords(5, "ZMW")).toBe("ZMW Five Only");
  });

  it("says so when the amount is negative", () => {
    expect(amountInWords(-1500, "UGX")).toBe("Minus Ugandan Shillings One Thousand Five Hundred Only");
  });

  it("reads zero as zero, not as an empty line", () => {
    expect(amountInWords(0, "UGX")).toBe("Ugandan Shillings Zero Only");
  });
});
