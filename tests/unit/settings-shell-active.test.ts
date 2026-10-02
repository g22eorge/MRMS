import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

const { isActive } = await import("@/components/settings/SettingsShell");

/**
 * The settings nav lit two items at once on any notifications child page:
 * /settings/notifications/whatsapp matched both /settings/notifications (as a
 * prefix of the current path) and the page itself. Choosing "WhatsApp" always
 * also highlighted "Notifications", which made it look like two settings were
 * open. Every nav item is a leaf page, so each should only be active on its
 * own exact path.
 */
describe("settings nav highlights the exact page, not its parent", () => {
  it("highlights the page you are on", () => {
    expect(isActive("/settings/notifications/whatsapp", "/settings/notifications/whatsapp")).toBe(true);
  });

  it("does not light up the parent notifications hub from a child page", () => {
    expect(isActive("/settings/notifications/whatsapp", "/settings/notifications")).toBe(false);
    expect(isActive("/settings/notifications/outbox", "/settings/notifications")).toBe(false);
  });

  it("does not light up a sibling page", () => {
    expect(isActive("/settings/notifications/whatsapp", "/settings/notifications/templates")).toBe(false);
    expect(isActive("/settings/notifications/whatsapp", "/settings/notifications/outbox")).toBe(false);
  });

  it("still highlights the hub when it is the exact page", () => {
    expect(isActive("/settings/notifications", "/settings/notifications")).toBe(true);
  });

  it("teaches the rule where the highlight is decided", () => {
    const src = readFileSync("components/settings/SettingsShell.tsx", "utf8");
    expect(src).toContain("return pathname === href;");
  });
});