import { describe, expect, it } from "vitest";

import { DOUBLE_SUBMIT_WINDOW_MS, isDoubleSubmit } from "@/lib/double-submit";

const NOW = new Date("2026-08-25T10:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms);

describe("isDoubleSubmit", () => {
  it("catches the impatient second tap", () => {
    expect(isDoubleSubmit(ago(400), NOW)).toBe(true);
    expect(isDoubleSubmit(ago(5_000), NOW)).toBe(true);
  });

  it("still catches a retry on a slow connection", () => {
    expect(isDoubleSubmit(ago(DOUBLE_SUBMIT_WINDOW_MS - 1_000), NOW)).toBe(true);
  });

  it("lets a genuine second entry through once the window closes", () => {
    expect(isDoubleSubmit(ago(DOUBLE_SUBMIT_WINDOW_MS), NOW)).toBe(false);
    expect(isDoubleSubmit(ago(10 * 60_000), NOW)).toBe(false);
  });

  it("treats a missing row as no duplicate", () => {
    expect(isDoubleSubmit(null, NOW)).toBe(false);
    expect(isDoubleSubmit(undefined, NOW)).toBe(false);
  });

  it("ignores a future timestamp rather than trusting clock skew", () => {
    // A replicated database can hand back a createdAt slightly ahead of us.
    // That must not read as "created 0ms ago" and swallow a real submission.
    expect(isDoubleSubmit(new Date(NOW + 30_000), NOW)).toBe(false);
  });
});
