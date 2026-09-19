import { describe, it, expect } from "bun:test";

import { composeExpenseNumber } from "@/lib/commercial/org-number";

describe("composeExpenseNumber", () => {
  it("follows Exp/TAG/YY/MM/NNN", () => {
    expect(composeExpenseNumber("EIS", new Date("2026-09-19T12:00:00.000Z"), 42)).toBe("Exp/EIS/26/09/042");
    expect(composeExpenseNumber("EIS", new Date("2026-01-05T12:00:00.000Z"), 7)).toBe("Exp/EIS/26/01/007");
  });

  it("grows past the pad instead of colliding", () => {
    expect(composeExpenseNumber("EIS", new Date("2026-09-19T12:00:00.000Z"), 1000)).toBe("Exp/EIS/26/09/1000");
  });

  it("works for another company's acronym", () => {
    expect(composeExpenseNumber("IMC", new Date("2027-03-02T12:00:00.000Z"), 1)).toBe("Exp/IMC/27/03/001");
  });
});
