import { describe, expect, it } from "bun:test";

import {
  COMMUNICATIONS_NAV,
  COMMUNICATIONS_ROUTES,
  canAccessCommunications,
  communicationsNavForRole,
} from "../../lib/communications/routes";

describe("COMMUNICATIONS_ROUTES", () => {
  it("defines canonical communications paths", () => {
    expect(COMMUNICATIONS_ROUTES.home).toBe("/communications");
    expect(COMMUNICATIONS_ROUTES.outbox).toBe("/communications/outbox");
    expect(COMMUNICATIONS_ROUTES.templates).toBe("/communications/templates");
    expect(COMMUNICATIONS_ROUTES.policies).toBe("/communications/policies");
    expect(COMMUNICATIONS_ROUTES.whatsapp).toBe("/communications/whatsapp");
    expect(COMMUNICATIONS_ROUTES.preferences).toBe("/settings/notifications");
  });

  it("maps legacy paths for redirect stubs", () => {
    expect(COMMUNICATIONS_ROUTES.legacyOutbox).toBe("/settings/notifications/outbox");
    expect(COMMUNICATIONS_ROUTES.legacyTemplates).toBe("/settings/notifications/templates");
    expect(COMMUNICATIONS_ROUTES.legacyWhatsapp).toBe("/settings/notifications/whatsapp");
    expect(COMMUNICATIONS_ROUTES.shortcutOutbox).toBe("/outbox");
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

  it("uses canonical hrefs in nav items", () => {
    for (const item of COMMUNICATIONS_NAV) {
      expect(item.href.startsWith("/communications/")).toBe(true);
    }
  });
});
