import { describe, expect, it } from "bun:test";

import { PAGE_STATE_KINDS, isEntityRecordId, RESERVED_ROUTE_SEGMENTS } from "../../lib/page-state/contract";

describe("page state contract", () => {
  it("defines the standard page state flow", () => {
    expect(PAGE_STATE_KINDS).toEqual(["loading", "content", "empty", "not-found", "error"]);
  });

  it("treats reserved route segments as non-record ids", () => {
    for (const segment of RESERVED_ROUTE_SEGMENTS) {
      expect(isEntityRecordId(segment)).toBe(false);
    }
  });

  it("accepts typical record ids and rejects short slugs", () => {
    expect(isEntityRecordId("clxyz1234567890abcdef")).toBe(true);
    expect(isEntityRecordId("board")).toBe(false);
    expect(isEntityRecordId("abc")).toBe(false);
  });
});
