import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

import { eatDateKey, eatDayEnd, eatDayStart, eatHour } from "@/lib/date-eat";

/**
 * The server ran on UTC, three hours behind Kampala. Between midnight and
 * 03:00 the dashboard said "Good evening" under yesterday's date, forms
 * defaulted to yesterday, and "today" in the figures had not started. These
 * pin the day and the hour to East Africa Time whatever clock the process is on.
 */
describe("the calendar day and hour in East Africa Time", () => {
  // 00:30 on Tuesday 24 November in Kampala is 21:30 on Monday in UTC.
  const justAfterMidnight = new Date("2026-11-23T21:30:00.000Z");
  const justBeforeMidnight = new Date("2026-11-23T20:59:00.000Z");

  it("has moved to the new day just after midnight", () => {
    expect(eatDateKey(justAfterMidnight)).toBe("2026-11-24");
    expect(eatHour(justAfterMidnight)).toBe(0);
  });

  it("is still the old day just before midnight", () => {
    expect(eatDateKey(justBeforeMidnight)).toBe("2026-11-23");
    expect(eatHour(justBeforeMidnight)).toBe(23);
  });

  it("gives a morning greeting's hour at 08:00 and an evening one at 19:00", () => {
    expect(eatHour(new Date("2026-11-24T05:00:00.000Z"))).toBe(8);
    expect(eatHour(new Date("2026-11-24T16:00:00.000Z"))).toBe(19);
  });

  it("keeps a date-only value on its own day", () => {
    // Saved from a date input as midnight UTC, or as midnight here: same day.
    expect(eatDateKey("2026-11-23")).toBe("2026-11-23");
    expect(eatDateKey(new Date("2026-11-22T21:00:00.000Z"))).toBe("2026-11-23");
  });

  it("returns an empty key for something that is not a date", () => {
    expect(eatDateKey("not a date")).toBe("");
  });
});

describe("the bounds of a day picked in a filter", () => {
  it("start at midnight here and end a millisecond before the next", () => {
    expect(eatDayStart("2026-11-23")?.toISOString()).toBe("2026-11-22T21:00:00.000Z");
    expect(eatDayEnd("2026-11-23")?.toISOString()).toBe("2026-11-23T20:59:59.999Z");
  });

  it("are null for anything that is not a day", () => {
    expect(eatDayStart("")).toBeNull();
    expect(eatDayStart("23/11/2026")).toBeNull();
    expect(eatDayEnd(undefined)).toBeNull();
  });
});

describe("the application's clock", () => {
  it("is set to East Africa Time in every container that runs app code", () => {
    // Everything that reads the local clock (getHours, getMonth, the day and
    // month ranges in lib/date-ranges.ts, document numbers) follows this.
    expect(readFileSync("docker-compose.yml", "utf8")).toContain("TZ: Africa/Kampala");
    expect(readFileSync("docker-compose.dev.yml", "utf8")).toContain("TZ: Africa/Kampala");
  });

  it("takes no calendar date straight from a UTC timestamp", () => {
    // toISOString().slice(0, 10) is the UTC day: yesterday until 03:00 here.
    for (const file of [
      "app/(app)/finance/expenses/page.tsx",
      "app/(app)/documents/invoices/CreateStandaloneInvoiceForm.tsx",
      "components/finance/NewJournalEntryForm.tsx",
      "app/(app)/payables/page.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/toISOString\(\)\.slice\(0, ?10\)/);
    }
  });
});
