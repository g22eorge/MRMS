import { describe, it, expect } from "bun:test";

import { composeUniversalNumber } from "@/lib/commercial/org-number";

describe("composeUniversalNumber", () => {
  it("follows TAG/TYPE/YYYY/MM/NNN", () => {
    expect(composeUniversalNumber("EIS", "EXP", new Date("2026-09-19T12:00:00.000Z"), 1)).toBe("EIS/EXP/2026/09/001");
    expect(composeUniversalNumber("EIS", "INV", new Date("2026-01-05T12:00:00.000Z"), 7)).toBe("EIS/INV/2026/01/007");
  });

  it("grows past the pad instead of colliding", () => {
    expect(composeUniversalNumber("EIS", "EXP", new Date("2026-09-19T12:00:00.000Z"), 1000)).toBe("EIS/EXP/2026/09/1000");
  });

  it("works for another company's code", () => {
    expect(composeUniversalNumber("IMC", "JOB", new Date("2027-03-02T12:00:00.000Z"), 1)).toBe("IMC/JOB/2027/03/001");
  });

  it("honours a larger org pad with a floor of 3", () => {
    expect(composeUniversalNumber("EIS", "INV", new Date("2026-09-19T12:00:00.000Z"), 42, 4)).toBe("EIS/INV/2026/09/0042");
    expect(composeUniversalNumber("EIS", "INV", new Date("2026-09-19T12:00:00.000Z"), 42, 2)).toBe("EIS/INV/2026/09/042");
  });
});
