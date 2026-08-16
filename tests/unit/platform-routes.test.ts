import { describe, expect, it } from "bun:test";

import { PLATFORM_ROUTES } from "../../lib/platform/routes";

describe("PLATFORM_ROUTES", () => {
  it("defines canonical platform console paths", () => {
    expect(PLATFORM_ROUTES.home).toBe("/platform");
    expect(PLATFORM_ROUTES.org("org-1")).toBe("/platform/orgs/org-1");
  });

  it("no longer exposes the removed /platform-admin redirect stubs", () => {
    // The legacy /platform-admin pages and their registry entries were deleted;
    // /platform is the only console path. Kept as a guard against reintroduction.
    expect("legacyAdminHome" in PLATFORM_ROUTES).toBe(false);
    expect("legacyAdminOrg" in PLATFORM_ROUTES).toBe(false);
  });
});
