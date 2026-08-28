import { describe, expect, it } from "bun:test";

import {
  COMMUNICATIONS_NAV,
  COMMUNICATIONS_ROUTES,
  canAccessCommunications,
  communicationsNavForRole,
} from "../../lib/communications/routes";

describe("COMMUNICATIONS_ROUTES", () => {
  /**
   * These assertions used to have it backwards — they required the canonical
   * paths to be /communications/*, which are redirect stubs, and called the
   * real pages legacy. The test passed while every outbox filter and every
   * template save banner was being lost to that redirect, because a stub
   * forwards no query string. Asserting the literal strings could never have
   * caught it; what matters is which path holds the page.
   */
  it("points at the pages themselves, not at the redirect stubs", () => {
    expect(COMMUNICATIONS_ROUTES.outbox).toBe("/settings/notifications/outbox");
    expect(COMMUNICATIONS_ROUTES.templates).toBe("/settings/notifications/templates");
    expect(COMMUNICATIONS_ROUTES.whatsapp).toBe("/settings/notifications/whatsapp");
    expect(COMMUNICATIONS_ROUTES.preferences).toBe("/settings/notifications");
  });

  it("never routes a query-carrying destination through a stub", () => {
    // The filters, the search box, the pagination and twenty save/error
    // redirects are all built from these. A stub in any of them silently drops
    // whatever the user was narrowing by.
    for (const key of ["outbox", "templates", "whatsapp"] as const) {
      expect(COMMUNICATIONS_ROUTES[key].startsWith("/communications/")).toBe(false);
    }
  });

  it("keeps the old paths addressable for existing bookmarks", () => {
    expect(COMMUNICATIONS_ROUTES.legacyOutbox).toBe("/communications/outbox");
    expect(COMMUNICATIONS_ROUTES.legacyTemplates).toBe("/communications/templates");
    expect(COMMUNICATIONS_ROUTES.legacyWhatsapp).toBe("/communications/whatsapp");
    expect(COMMUNICATIONS_ROUTES.shortcutOutbox).toBe("/outbox");
    expect(COMMUNICATIONS_ROUTES.home).toBe("/communications");
  });
});

describe("communicationsNavForRole", () => {
  it("returns outbox, templates, and policies for OPS", () => {
    const keys = communicationsNavForRole("OPS").map((item) => item.key);
    expect(keys).toEqual(["outbox", "templates", "policies"]);
  });

  it("includes WhatsApp for ADMIN only", () => {
    const adminKeys = communicationsNavForRole("ADMIN").map((item) => item.key);
    expect(adminKeys).toEqual(["outbox", "templates", "policies", "whatsapp"]);
    expect(communicationsNavForRole("OPS").some((item) => item.key === "whatsapp")).toBe(false);
  });

  it("denies access for roles outside communications nav", () => {
    expect(canAccessCommunications("TECHNICIAN_INTERNAL")).toBe(false);
    expect(canAccessCommunications("FRONT_DESK")).toBe(false);
    expect(canAccessCommunications("OPS")).toBe(true);
    expect(canAccessCommunications("ADMIN")).toBe(true);
  });

  it("navigates to pages that hold content rather than to stubs", () => {
    for (const item of COMMUNICATIONS_NAV) {
      expect(item.href.startsWith("/settings/notifications")).toBe(true);
    }
  });
});
