import { describe, expect, it } from "bun:test";
import type { Role } from "@prisma/client";

import {
  PINNED_HREFS,
  SUPER_GROUP_ORDER,
  activeSuperGroup,
  buildSidebarModel,
  orderedNavForRole,
} from "../../lib/nav/sidebar-model";

function hrefs(items: { href: string }[]) {
  return items.map((i) => i.href);
}

function allModelHrefs(role: Role, permissions: string[] = [], modules?: Set<string>) {
  const m = buildSidebarModel(role, permissions, modules);
  return [...hrefs(m.pinned), ...m.sections.flatMap((s) => hrefs(s.items))];
}

describe("sidebar model — pinned daily items", () => {
  it("pins dashboard, jobs, intake, clients, pos for ADMIN in priority order", () => {
    const { pinned } = buildSidebarModel("ADMIN", []);
    expect(hrefs(pinned)).toEqual(["/dashboard", "/jobs", "/intake", "/clients", "/pos"]);
  });

  it("only pins items the role can actually see", () => {
    const { pinned } = buildSidebarModel("TECHNICIAN_EXTERNAL", []);
    // External techs get dashboard + jobs, but not intake/clients/pos.
    expect(hrefs(pinned)).toEqual(["/dashboard", "/jobs"]);
  });

  it("keeps pinned items in the PINNED_HREFS order regardless of role ordering", () => {
    const { pinned } = buildSidebarModel("SALES_POS", []);
    // Jobs is visible to every role, so SALES_POS pins dashboard + jobs + pos —
    // and always in PINNED_HREFS order, not role-order.
    expect(hrefs(pinned)).toEqual(["/dashboard", "/jobs", "/pos"]);
  });
});

describe("sidebar model — super-groups", () => {
  it("produces at most the four canonical groups in order", () => {
    const { sections } = buildSidebarModel("ADMIN", []);
    const groups = sections.map((s) => s.group);
    // must be a subsequence of the canonical order
    const canonical = [...SUPER_GROUP_ORDER];
    expect(groups).toEqual(canonical.filter((g) => groups.includes(g)));
    expect(groups.length).toBeLessThanOrEqual(4);
  });

  it("routes the documents hub + finance into the money group for ADMIN", () => {
    const { sections } = buildSidebarModel("ADMIN", []);
    const money = sections.find((s) => s.group === "money");
    expect(money).toBeTruthy();
    const h = hrefs(money!.items);
    expect(h).toContain("/documents"); // single documents hub (tabs cover leaves)
    expect(h).toContain("/finance"); // finance hub folds into money
    expect(h).not.toContain("/documents/invoices"); // leaves are not duplicated in the sidebar
  });

  it("routes inventory/procurement into the stock group", () => {
    const { sections } = buildSidebarModel("ADMIN", []);
    const stock = sections.find((s) => s.group === "stock");
    expect(hrefs(stock!.items)).toEqual(
      expect.arrayContaining(["/inventory", "/procurement", "/inventory/purchase-orders"]),
    );
  });

  it("puts communications + settings in the admin group", () => {
    const { sections } = buildSidebarModel("ADMIN", []);
    const admin = sections.find((s) => s.group === "admin");
    const h = hrefs(admin!.items);
    expect(h).toContain("/settings");
    expect(h).toContain("/communications");
  });

  it("never lists an item in both pinned and a group", () => {
    const roles: Role[] = ["ADMIN", "MANAGER", "OPS", "FINANCE", "SALES", "FRONT_DESK", "TECHNICIAN_INTERNAL", "TECHNICIAN_EXTERNAL"];
    for (const role of roles) {
      const m = buildSidebarModel(role, []);
      const pinnedSet = new Set(hrefs(m.pinned));
      for (const section of m.sections) {
        for (const item of section.items) {
          expect(pinnedSet.has(item.href)).toBe(false);
        }
      }
    }
  });

  it("has no duplicate hrefs across the whole model for any role", () => {
    const roles: Role[] = ["ADMIN", "MANAGER", "OPS", "FINANCE", "SALES", "FRONT_DESK", "TECHNICIAN_INTERNAL", "TECHNICIAN_EXTERNAL", "SALES_MANAGER", "SALES_POS"];
    for (const role of roles) {
      const all = allModelHrefs(role);
      expect(new Set(all).size).toBe(all.length);
    }
  });
});

describe("sidebar model — parity with role visibility", () => {
  it("surfaces exactly the same hrefs as orderedNavForRole", () => {
    const roles: Role[] = ["ADMIN", "OPS", "FINANCE", "SALES", "FRONT_DESK", "TECHNICIAN_EXTERNAL"];
    for (const role of roles) {
      const flat = new Set(orderedNavForRole(role, []).map((i) => i.href));
      const model = new Set(allModelHrefs(role));
      expect(model).toEqual(flat);
    }
  });

  it("respects module gating — disabling INVENTORY removes inventory items", () => {
    const withInventory = new Set(["INVENTORY", "JOBS", "INVOICING", "POS", "REPORTS", "SALES", "PURCHASE_ORDERS", "COMPLAINTS", "FIELD", "TARGETS"]);
    const withoutInventory = new Set([...withInventory].filter((m) => m !== "INVENTORY"));

    const on = allModelHrefs("ADMIN", [], withInventory);
    const off = allModelHrefs("ADMIN", [], withoutInventory);

    expect(on).toContain("/inventory");
    expect(off).not.toContain("/inventory");
  });

  it("keeps Settings visible for every role", () => {
    const roles: Role[] = ["ADMIN", "MANAGER", "OPS", "FINANCE", "SALES", "FRONT_DESK", "TECHNICIAN_INTERNAL", "TECHNICIAN_EXTERNAL", "SALES_POS", "INTAKE"];
    for (const role of roles) {
      expect(allModelHrefs(role)).toContain("/settings");
    }
  });
});

describe("sidebar model — active group detection", () => {
  it("finds the group that owns the active href", () => {
    const model = buildSidebarModel("ADMIN", []);
    expect(activeSuperGroup(model, "/documents")).toBe("money");
    expect(activeSuperGroup(model, "/inventory")).toBe("stock");
    expect(activeSuperGroup(model, "/settings")).toBe("admin");
  });

  it("returns null for pinned or unknown paths", () => {
    const model = buildSidebarModel("ADMIN", []);
    expect(activeSuperGroup(model, "/dashboard")).toBeNull(); // pinned, not in a group
    expect(activeSuperGroup(model, null)).toBeNull();
    expect(activeSuperGroup(model, "/nonexistent")).toBeNull();
  });
});

describe("sidebar model — constants", () => {
  it("exposes the expected pinned hrefs", () => {
    expect(PINNED_HREFS).toEqual(["/dashboard", "/jobs", "/intake", "/clients", "/pos"]);
  });
});
