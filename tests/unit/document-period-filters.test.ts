import { describe, expect, it } from "bun:test";

import {
  dateFilterForDocumentPeriod,
  matchesDocumentPeriod,
} from "../../lib/documents/period-filters";

describe("dateFilterForDocumentPeriod()", () => {
  const now = new Date(2026, 6, 15, 12, 0, 0);

  it("returns undefined for all", () => {
    expect(dateFilterForDocumentPeriod("all", now)).toBeUndefined();
  });

  it("returns gte for this_month", () => {
    const filter = dateFilterForDocumentPeriod("this_month", now);
    expect(filter?.gte?.getMonth()).toBe(6);
    expect(filter?.gte?.getDate()).toBe(1);
  });

  it("returns bounded range for last_month", () => {
    const filter = dateFilterForDocumentPeriod("last_month", now);
    expect(filter?.gte?.getMonth()).toBe(5);
    expect(filter?.lte?.getMonth()).toBe(5);
  });
});

describe("matchesDocumentPeriod()", () => {
  const now = new Date(2026, 6, 15, 12, 0, 0);

  it("matches all periods", () => {
    expect(matchesDocumentPeriod(new Date(2020, 0, 1), "all", now)).toBe(true);
  });

  it("filters this_month", () => {
    expect(matchesDocumentPeriod(new Date(2026, 6, 10), "this_month", now)).toBe(true);
    expect(matchesDocumentPeriod(new Date(2026, 5, 28), "this_month", now)).toBe(false);
  });
});
