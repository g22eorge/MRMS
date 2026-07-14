import { describe, expect, it } from "bun:test";
import {
  daysBetween,
  monthLabel,
  monthRange,
  monthRangeFromDate,
  monthSequence,
  previousMonthRange,
  yearRange,
} from "../../lib/date-ranges";

describe("monthRange()", () => {
  it("returns inclusive January 2025 bounds", () => {
    const { start, end } = monthRange(2025, 1);
    expect(start).toEqual(new Date(2025, 0, 1, 0, 0, 0, 0));
    expect(end).toEqual(new Date(2025, 1, 0, 23, 59, 59, 999));
  });
});

describe("monthRangeFromDate()", () => {
  it("matches monthRange for the same calendar month", () => {
    const date = new Date(2025, 5, 15);
    expect(monthRangeFromDate(date)).toEqual(monthRange(2025, 6));
  });
});

describe("previousMonthRange()", () => {
  it("steps back one month", () => {
    const now = new Date(2025, 2, 10);
    expect(previousMonthRange(now)).toEqual(monthRange(2025, 2));
  });
});

describe("yearRange()", () => {
  it("spans the full calendar year", () => {
    const { start, end } = yearRange(2024);
    expect(start.getFullYear()).toBe(2024);
    expect(end.getFullYear()).toBe(2024);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });
});

describe("monthLabel()", () => {
  it("zero-pads month", () => {
    expect(monthLabel(2025, 3)).toBe("2025-03");
  });
});

describe("monthSequence()", () => {
  it("returns descending months ending at the anchor", () => {
    const seq = monthSequence(2025, 3, 2);
    expect(seq.map((m) => m.key)).toEqual(["2025-02", "2025-03"]);
  });
});

describe("daysBetween()", () => {
  it("counts whole days between instants", () => {
    const start = new Date("2025-01-01T00:00:00");
    const end = new Date("2025-01-04T00:00:00");
    expect(daysBetween(start, end)).toBe(3);
  });
});
