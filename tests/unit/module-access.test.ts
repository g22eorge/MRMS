import { describe, it, expect } from "bun:test";
import { getOrgModules } from "../../lib/module-access";

// ── ALL_MODULES ───────────────────────────────────────────────────────────────


// ── MODULE_LABELS ─────────────────────────────────────────────────────────────


// ── MODULE_ICONS ──────────────────────────────────────────────────────────────


// ── getOrgModules() ───────────────────────────────────────────────────────────

// getOrgModules() wraps Next's unstable_cache, which needs an incremental-cache
// context that does not exist outside a Next runtime. Covered by integration/E2E
// rather than unit tests — skipped explicitly so the gap stays visible.
describe.skip("getOrgModules()", () => {
  it("returns a Set", async () => {
    const result = await getOrgModules("any-org-id");
    expect(result).toBeInstanceOf(Set);
  });

  it("returns all 10 modules regardless of orgId", async () => {
    const result = await getOrgModules("some-org");
    expect(result.size).toBe(ALL_MODULES.length);
  });

  it("includes every module from ALL_MODULES", async () => {
    const result = await getOrgModules("org-123");
    for (const mod of ALL_MODULES) {
      expect(result.has(mod)).toBe(true);
    }
  });

  it("works with an empty string orgId", async () => {
    const result = await getOrgModules("");
    expect(result.size).toBe(10);
  });
});
