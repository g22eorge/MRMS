import { describe, expect, it } from "bun:test";

import {
  buildCommandPaletteQuickActions,
  filterCommandPaletteActions,
  normalizeCommandQuery,
} from "../../lib/command-palette/quick-actions";

describe("command palette quick actions", () => {
  it("includes dashboard for all roles", () => {
    const actions = buildCommandPaletteQuickActions({ role: "TECHNICIAN_INTERNAL", permissions: [] });
    expect(actions.some((action) => action.id === "dashboard")).toBe(true);
  });

  it("includes new job and record payment for ADMIN", () => {
    const actions = buildCommandPaletteQuickActions({ role: "ADMIN", permissions: [] });
    expect(actions.some((action) => action.id === "new-job")).toBe(true);
    expect(actions.some((action) => action.id === "record-payment")).toBe(true);
    expect(actions.some((action) => action.id === "outbox")).toBe(true);
  });

  it("excludes financial actions for TECHNICIAN_INTERNAL without finance perms", () => {
    const actions = buildCommandPaletteQuickActions({ role: "TECHNICIAN_INTERNAL", permissions: [] });
    expect(actions.some((action) => action.id === "record-payment")).toBe(false);
    expect(actions.some((action) => action.id === "jobs")).toBe(true);
  });

  it("filters actions by query", () => {
    const actions = buildCommandPaletteQuickActions({ role: "ADMIN", permissions: [] });
    const filtered = filterCommandPaletteActions(actions, "invoice");
    expect(filtered.some((action) => action.id === "invoices")).toBe(true);
    expect(filtered.every((action) => [action.label, action.description ?? "", ...(action.keywords ?? [])].join(" ").toLowerCase().includes("invoice"))).toBe(true);
  });

  it("normalizes query text", () => {
    expect(normalizeCommandQuery("  Invoice  ")).toBe("invoice");
  });
});
