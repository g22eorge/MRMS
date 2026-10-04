/**
 * SPEC-001 tracking links. buildTrackingUrl is pure (takes the app URL
 * explicitly); the opt-out gate hits the DB and is covered end-to-end by
 * tracking-link.spec.ts instead.
 */
import { describe, it, expect } from "bun:test";

import { buildTrackingUrl } from "../../lib/notifications/index";

describe("buildTrackingUrl()", () => {
  it("builds the status link", () => {
    expect(buildTrackingUrl("https://app.example.com", "E2E-TRACK-0001")).toBe(
      "https://app.example.com/status/E2E-TRACK-0001",
    );
  });

  it("keeps slashes in job numbers readable", () => {
    expect(buildTrackingUrl("https://app.example.com", "EIS-3/2025/0042")).toBe(
      "https://app.example.com/status/EIS-3/2025/0042",
    );
  });

  it("encodes genuinely unsafe characters", () => {
    expect(buildTrackingUrl("https://app.example.com", "JOB 42 & co")).toBe(
      "https://app.example.com/status/JOB%2042%20%26%20co",
    );
  });

  it("returns empty without an app URL (no link, never broken)", () => {
    expect(buildTrackingUrl(undefined, "E2E-TRACK-0001")).toBe("");
    expect(buildTrackingUrl("", "E2E-TRACK-0001")).toBe("");
  });
});
