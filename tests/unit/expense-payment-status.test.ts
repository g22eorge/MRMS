import { describe, it, expect } from "bun:test";

import { expensePaymentStatus } from "@/lib/commercial/expense-payments";

describe("expensePaymentStatus", () => {
  it("derives UNPAID / PART_PAID / PAID from paid progress", () => {
    expect(expensePaymentStatus(1000, 0)).toBe("UNPAID");
    expect(expensePaymentStatus(1000, 400)).toBe("PART_PAID");
    expect(expensePaymentStatus(1000, 1000)).toBe("PAID");
    expect(expensePaymentStatus(1000, 1200)).toBe("PAID");
  });
});
