import { describe, it, expect } from "bun:test";

import { cashAccountFor } from "@/lib/accounting/post";

describe("cashAccountFor", () => {
  it("maps each payment channel to its sub-account", () => {
    expect(cashAccountFor("CASH")).toBe("1010");
    expect(cashAccountFor("MOBILE_MONEY")).toBe("1020");
    expect(cashAccountFor("BANK_TRANSFER")).toBe("1030");
    expect(cashAccountFor("CARD")).toBe("1030");
  });

  it("falls back to the pooled parent for unknown or missing methods", () => {
    expect(cashAccountFor("OTHER")).toBe("1000");
    expect(cashAccountFor("")).toBe("1000");
    expect(cashAccountFor(null)).toBe("1000");
    expect(cashAccountFor(undefined)).toBe("1000");
    expect(cashAccountFor("cash")).toBe("1010");
  });
});
