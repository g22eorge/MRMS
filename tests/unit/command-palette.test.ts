import { describe, expect, it } from "bun:test";

import {
  buildCommandPaletteActions,
  filterCommandActions,
  normalizeCommandQuery,
} from "../../lib/command-palette/quick-actions";

describe("command palette quick actions", () => {
  it("includes dashboard quick actions for ADMIN with modules enabled", () => {
    const actions = buildCommandPaletteActions({
      role: "ADMIN",
      permissions: [],
      enabledModules: new Set(["JOBS", "INVOICING", "POS", "PURCHASE_ORDERS"]),
    });
    const ids = actions.map((action) => action.id);
    expect(ids).toContain("new-job");
    expect(ids).toContain("record-payment");
    expect(ids).toContain("product-sale");
    expect(ids).toContain("purchase-order");
  });

  it("filters actions by query keywords", () => {
    const actions = buildCommandPaletteActions({
      role: "ADMIN",
      permissions: [],
      enabledModules: new Set(["JOBS", "INVOICING"]),
    });
    const filtered = filterCommandActions(actions, "receipt");
    expect(filtered.some((action) => action.id === "record-payment")).toBe(true);
    expect(filtered.some((action) => action.id === "new-job")).toBe(false);
  });

  it("normalizes whitespace in queries", () => {
    expect(normalizeCommandQuery("  job   123  ")).toBe("job 123");
  });

  it("keeps TECHNICIAN_EXTERNAL actions minimal", () => {
    const actions = buildCommandPaletteActions({
      role: "TECHNICIAN_EXTERNAL",
      permissions: [],
      enabledModules: new Set(["JOBS", "INVOICING"]),
    });
    expect(actions.some((action) => action.id === "open-clients")).toBe(false);
    expect(actions.some((action) => action.id === "record-payment")).toBe(false);
    expect(actions.length).toBe(0);
  });
});
