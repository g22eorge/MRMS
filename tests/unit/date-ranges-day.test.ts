import { describe, it, expect } from "bun:test";

import { dayRange, previousDayRange, weekRange, monthRangeFromDate } from "@/lib/date-ranges";

/**
 * Day and week windows.
 *
 * These exist because the shortest question an owner asks — "how much have I
 * collected today?" — had no answer. Every figure in the system was computed
 * over a calendar month, so the smallest available window was "this month so
 * far", which is not what someone asks at closing time.
 *
 * Two things here are easy to break and expensive when broken, so they are
 * pinned rather than assumed: the boundaries are LOCAL, and the week starts on
 * Monday.
 */

describe("a day is the local calendar day", () => {
  it("runs from local midnight to the last millisecond of the day", () => {
    const r = dayRange(new Date(2026, 7, 31, 14, 22, 5));
    expect(r.start.getHours()).toBe(0);
    expect(r.start.getMinutes()).toBe(0);
    expect(r.start.getSeconds()).toBe(0);
    expect(r.start.getMilliseconds()).toBe(0);
    expect(r.end.getHours()).toBe(23);
    expect(r.end.getMinutes()).toBe(59);
    expect(r.end.getSeconds()).toBe(59);
    expect(r.end.getMilliseconds()).toBe(999);
  });

  it("stays on the same calendar date at both ends", () => {
    const r = dayRange(new Date(2026, 7, 31, 23, 59));
    expect(r.start.getDate()).toBe(31);
    expect(r.end.getDate()).toBe(31);
    expect(r.start.getMonth()).toBe(7);
    expect(r.end.getMonth()).toBe(7);
  });

  it("uses local time, not UTC", () => {
    // The failure this prevents: a shop closing at 8pm in Kampala against a UTC
    // day boundary disagree by three hours, so "today" would silently include
    // three hours of yesterday's takings. A day figure that is quietly wrong is
    // worse than no day figure.
    const r = dayRange(new Date(2026, 7, 31, 12, 0));
    expect(r.start.getTimezoneOffset()).toBe(new Date(2026, 7, 31).getTimezoneOffset());
    expect(r.start.getDate()).toBe(31);
  });

  it("covers an instant early in the morning and late at night alike", () => {
    for (const hour of [0, 6, 12, 23]) {
      const at = new Date(2026, 7, 31, hour, 30);
      const r = dayRange(at);
      expect(at.getTime()).toBeGreaterThanOrEqual(r.start.getTime());
      expect(at.getTime()).toBeLessThanOrEqual(r.end.getTime());
    }
  });

  it("rolls back across a month boundary", () => {
    const r = previousDayRange(new Date(2026, 8, 1, 9, 0)); // 1 September
    expect(r.start.getMonth()).toBe(7); // August
    expect(r.start.getDate()).toBe(31);
  });

  it("rolls back across a year boundary", () => {
    const r = previousDayRange(new Date(2026, 0, 1, 9, 0)); // 1 January
    expect(r.start.getFullYear()).toBe(2025);
    expect(r.start.getMonth()).toBe(11);
    expect(r.start.getDate()).toBe(31);
  });
});

describe("a week starts on Monday", () => {
  it("puts a Monday at the start of its own week", () => {
    const monday = new Date(2026, 7, 31); // 31 Aug 2026 is a Monday
    expect(monday.getDay()).toBe(1);
    const r = weekRange(monday);
    expect(r.start.getDate()).toBe(31);
    expect(r.end.getDate()).toBe(6); // Sunday 6 September
  });

  it("puts a Sunday at the END of the week, not the start", () => {
    // getDay() calls Sunday 0, so the naive arithmetic puts Sunday at the start
    // of the following week and moves a whole day of takings into the wrong
    // week. This is the specific bug being pinned.
    const sunday = new Date(2026, 8, 6);
    expect(sunday.getDay()).toBe(0);
    const r = weekRange(sunday);
    expect(r.start.getDate()).toBe(31); // still the Monday before
    expect(r.start.getMonth()).toBe(7); // August
    expect(r.end.getDate()).toBe(6);
  });

  it("spans exactly seven calendar days", () => {
    const r = weekRange(new Date(2026, 8, 3));
    // Monday 00:00:00.000 to Sunday 23:59:59.999 is seven days less one
    // millisecond — asserted exactly rather than rounded, because a rounded
    // span hides an off-by-one-day error.
    expect(r.end.getTime() - r.start.getTime()).toBe(7 * 86_400_000 - 1);
    expect(r.start.getDay()).toBe(1);
    expect(r.end.getDay()).toBe(0);
  });
});

describe("the windows nest the way a reader expects", () => {
  it("a day sits inside its month", () => {
    const at = new Date(2026, 7, 15, 10, 0);
    const day = dayRange(at);
    const month = monthRangeFromDate(at);
    expect(day.start.getTime()).toBeGreaterThanOrEqual(month.start.getTime());
    expect(day.end.getTime()).toBeLessThanOrEqual(month.end.getTime());
  });

  it("yesterday never overlaps today", () => {
    const at = new Date(2026, 7, 31, 10, 0);
    expect(previousDayRange(at).end.getTime()).toBeLessThan(dayRange(at).start.getTime());
  });
});
