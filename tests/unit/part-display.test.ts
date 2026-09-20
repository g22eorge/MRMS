import { describe, it, expect } from "bun:test";

import { partShortView } from "@/lib/part-display";

describe("partShortView", () => {
  it("prefers the user-picked short line", () => {
    expect(
      partShortView({ shortDescription: "Genuine 65W USB-C adapter", description: "Long narrative\nsecond line" }),
    ).toBe("Genuine 65W USB-C adapter");
  });

  it("falls back to the description's first line", () => {
    expect(partShortView({ shortDescription: null, description: "First line\nSecond line" })).toBe("First line");
    expect(partShortView({ shortDescription: "  ", description: "Only line" })).toBe("Only line");
  });

  it("is empty when there is nothing to show", () => {
    expect(partShortView({ shortDescription: null, description: null })).toBe("");
    expect(partShortView({})).toBe("");
  });
});
