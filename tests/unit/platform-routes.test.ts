import { describe, expect, it } from "bun:test";

import { PLATFORM_ROUTES } from "../../lib/platform/routes";

describe("PLATFORM_ROUTES", () => {
  it("defines canonical platform console paths", () => {
    expect(PLATFORM_ROUTES.home).toBe("/platform");
    expect(PLATFORM_ROUTES.org("org-1")).toBe("/platform/orgs/org-1");
  });

  it("maps legacy admin paths for redirect stubs", () => {
    expect(PLATFORM_ROUTES.legacyAdminHome).toBe("/platform-admin");
    expect(PLATFORM_ROUTES.legacyAdminOrg("org-1")).toBe("/platform-admin/orgs/org-1");
  });
});
