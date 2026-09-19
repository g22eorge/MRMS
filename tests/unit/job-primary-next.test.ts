import { describe, it, expect } from "bun:test";

import { primaryNextStatus } from "@/lib/job-status";

/**
 * The primary CTA must walk the happy path: pressing the big button
 * repeatedly has to reach completion, never divert into a side branch
 * (IN_REPAIR once led with WAITING_FOR_PARTS).
 */
describe("primaryNextStatus", () => {
  it("walks RECEIVED → COMPLETED along the happy path", () => {
    const map = {
      RECEIVED: ["DIAGNOSING"],
      DIAGNOSING: ["REFERRED", "IN_REPAIR"],
      IN_REPAIR: ["WAITING_FOR_PARTS", "READY_FOR_PICKUP", "COMPLETED", "CLOSED"],
      READY_FOR_PICKUP: ["DELIVERED", "COMPLETED", "CLOSED"],
      DELIVERED: ["COMPLETED"],
    } as const;
    let at: string = "RECEIVED";
    const trail = [at];
    for (let i = 0; i < 6 && at !== "COMPLETED"; i += 1) {
      const next = primaryNextStatus(at as never, [...(map as Record<string, readonly string[]>)[at]] as never[]);
      expect(next).not.toBeNull();
      at = next as string;
      trail.push(at);
    }
    expect(at).toBe("COMPLETED");
    expect(trail).toEqual(["RECEIVED", "DIAGNOSING", "IN_REPAIR", "READY_FOR_PICKUP", "COMPLETED"]);
  });

  it("falls back to the first visible option and null when terminal", () => {
    expect(primaryNextStatus("IN_REPAIR" as never, ["CLOSED"] as never[])).toBe("CLOSED");
    expect(primaryNextStatus("COMPLETED" as never, [] as never[])).toBeNull();
  });
});
