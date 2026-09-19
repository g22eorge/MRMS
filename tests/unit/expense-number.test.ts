import { describe, it, expect } from "bun:test";

import { composeExpenseNumber } from "@/lib/commercial/org-number";

describe("composeExpenseNumber", () => {
  it("follows TAG/MM/NNN", () => {
    expect(composeExpenseNumber("EIS", new Date("2026-09-19T12:00:00.000Z"), 42)).toBe("EIS/09/042");
    expect(composeExpenseNumber("EIS", new Date("2026-01-05T12:00:00.000Z"), 7)).toBe("EIS/01/007");
  });

  it("grows past the pad instead of colliding", () => {
    expect(composeExpenseNumber("EIS", new Date("2026-09-19T12:00:00.000Z"), 1000)).toBe("EIS/09/1000");
  });
});
