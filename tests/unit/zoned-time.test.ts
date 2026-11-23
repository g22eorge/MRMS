import { describe, it, expect } from "bun:test";

import {
  DEFAULT_ZONE, isValidZone, zoneOffsetMinutes, zoneOrDefault, zonedDateKey, zonedInstant,
  zonedParts, zonedStartOfDay, zonedStartOfMonth,
} from "@/lib/zoned-time";

describe("a business's own calendar", () => {
  // 21:30 UTC on Monday 23 November.
  const at = new Date("2026-11-23T21:30:00.000Z");

  it("is already Tuesday in Kampala and still Monday in Accra", () => {
    expect(zonedDateKey(at, "Africa/Kampala")).toBe("2026-11-24");
    expect(zonedDateKey(at, "Africa/Accra")).toBe("2026-11-23");
    expect(zonedParts(at, "Africa/Kampala").hour).toBe(0);
    expect(zonedParts(at, "Africa/Accra").hour).toBe(21);
  });

  it("starts the day at that place's midnight", () => {
    expect(zonedStartOfDay(at, "Africa/Kampala").toISOString()).toBe("2026-11-23T21:00:00.000Z");
    expect(zonedStartOfDay(at, "Africa/Accra").toISOString()).toBe("2026-11-23T00:00:00.000Z");
  });

  it("starts the month at that place's midnight on the 1st", () => {
    const monthEnd = new Date("2026-11-30T22:00:00.000Z"); // 1 Dec in Kampala, 30 Nov in Accra
    expect(zonedStartOfMonth(monthEnd, "Africa/Kampala").toISOString()).toBe("2026-11-30T21:00:00.000Z");
    expect(zonedStartOfMonth(monthEnd, "Africa/Accra").toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("knows each place's offset from UTC", () => {
    expect(zoneOffsetMinutes(at, "Africa/Kampala")).toBe(180);
    expect(zoneOffsetMinutes(at, "Africa/Accra")).toBe(0);
    expect(zoneOffsetMinutes(at, "Africa/Lagos")).toBe(60);
  });

  it("handles a zone with daylight saving on both sides of the change", () => {
    expect(zonedStartOfDay(new Date("2026-01-15T12:00:00Z"), "Europe/London").toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(zonedStartOfDay(new Date("2026-07-15T12:00:00Z"), "Europe/London").toISOString()).toBe("2026-07-14T23:00:00.000Z");
    expect(zonedInstant(2026, 3, 29, 12, 0, 0, 0, "Europe/London").toISOString()).toBe("2026-03-29T11:00:00.000Z");
  });

  it("gives Kampala exactly what the server's own clock gives, so nothing moves for existing businesses", () => {
    // The containers run on Africa/Kampala; a business left on the default
    // must see the same day boundaries as before this existed.
    for (const iso of ["2026-11-23T20:59:59.000Z", "2026-11-23T21:00:00.000Z", "2026-06-01T03:15:00.000Z", "2026-12-31T22:00:00.000Z"]) {
      const instant = new Date(iso);
      const kampalaWallClock = new Date(instant.getTime() + 180 * 60_000);
      const expected = Date.UTC(kampalaWallClock.getUTCFullYear(), kampalaWallClock.getUTCMonth(), kampalaWallClock.getUTCDate()) - 180 * 60_000;
      expect(zonedStartOfDay(instant, DEFAULT_ZONE).getTime()).toBe(expected);
    }
  });

  it("falls back to Kampala for a missing or invalid zone", () => {
    expect(isValidZone("Africa/Accra")).toBe(true);
    expect(isValidZone("Mars/Olympus")).toBe(false);
    expect(zoneOrDefault(null)).toBe("Africa/Kampala");
    expect(zoneOrDefault("not a zone")).toBe("Africa/Kampala");
    expect(zonedDateKey(at, "not a zone")).toBe("2026-11-24");
  });
});
