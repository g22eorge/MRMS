import { describe, it, expect } from "bun:test";

import { advanceRecurringDate, isRecurringFrequency, recurringPeriodKey } from "@/lib/commercial/recurring-schedule";

describe("advanceRecurringDate", () => {
  it("steps each frequency forward", () => {
    const from = new Date("2026-01-15T12:00:00.000Z");
    expect(advanceRecurringDate(from, "WEEKLY").toISOString()).toBe("2026-01-22T12:00:00.000Z");
    expect(advanceRecurringDate(from, "MONTHLY").toISOString()).toBe("2026-02-15T12:00:00.000Z");
    expect(advanceRecurringDate(from, "QUARTERLY").toISOString()).toBe("2026-04-15T12:00:00.000Z");
    expect(advanceRecurringDate(from, "ANNUAL").toISOString()).toBe("2027-01-15T12:00:00.000Z");
  });

  it("always moves forward in time", () => {
    const from = new Date("2026-03-10T12:00:00.000Z");
    for (const f of ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"] as const) {
      expect(advanceRecurringDate(from, f).getTime()).toBeGreaterThan(from.getTime());
    }
  });
});

describe("isRecurringFrequency / recurringPeriodKey", () => {
  it("validates frequencies", () => {
    expect(isRecurringFrequency("MONTHLY")).toBe(true);
    expect(isRecurringFrequency("daily")).toBe(false);
    expect(isRecurringFrequency("")).toBe(false);
  });

  it("keys periods by month", () => {
    expect(recurringPeriodKey(new Date("2026-01-05T00:00:00.000Z"))).toBe("202601");
    expect(recurringPeriodKey(new Date("2026-12-31T00:00:00.000Z"))).toBe("202612");
  });
});
