import { describe, expect, it } from "bun:test";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
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
    expect(hrefs(pinned)).toEqual(["/dashboard", "/jobs", "/clients", "/pos"]);
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
    expect(groups.length).toBeLessThanOrEqual(SUPER_GROUP_ORDER.length);
  });

  it("routes the documents hub + finance into the money group for ADMIN", () => {
    const { sections } = buildSidebarModel("ADMIN", []);
    const docs = sections.find((s) => s.group === "documents");
    const finance = sections.find((s) => s.group === "finance");
    expect(docs).toBeTruthy();
    expect(finance).toBeTruthy();
    const h = [...hrefs(docs!.items), ...hrefs(finance!.items)];
    expect(h).toContain("/documents"); // single documents hub (tabs cover leaves)
    expect(h).toContain("/finance");
    expect(h).not.toContain("/documents/invoices"); // leaves are not duplicated in the sidebar
  });

  it("carries the inventory hub only, with its leaves left to the tab bar", () => {
    // Inventory is now arranged like Documents, and this asserts the same rule
    // the documents test above does: the section is in the sidebar, and its
    // pages are tabs on the hub. Previously both carried purchase orders, goods
    // received, supplier bills, stock counts and suppliers — the same page with
    // two routes to it a few centimetres apart, neither aware of the other.
    const { sections } = buildSidebarModel("ADMIN", []);
    const stock = sections.find((s) => s.group === "inventory");
    expect(stock).toBeTruthy();
    expect(hrefs(stock!.items)).toContain("/inventory");
    for (const leaf of [
      "/inventory/purchase-orders",
      "/inventory/supplier-bills",
      "/inventory/goods-received",
      "/inventory/stock-counts",
      "/inventory/suppliers",
    ]) {
      expect(hrefs(stock!.items)).not.toContain(leaf);
    }
    // the /procurement desk was removed from the sidebar
    expect(hrefs(stock!.items)).not.toContain("/procurement");
  });

  it("keeps every sidebar-dropped inventory page reachable as a tab", () => {
    // Guards the guard: dropping a leaf from the sidebar is only safe because
    // the hub tabs carry it. If a tab is removed without restoring the sidebar
    // entry, the page becomes reachable only by typing its URL.
    const tabHrefs = INVENTORY_TABS.map((t) => t.href);
    for (const leaf of [
      "/inventory/purchase-orders",
      "/inventory/supplier-bills",
      "/inventory/goods-received",
      "/inventory/stock-counts",
      "/inventory/suppliers",
      "/inventory/purchase-requests",
      "/inventory/transfers",
      "/inventory/locations",
    ]) {
      expect(tabHrefs).toContain(leaf);
    }
  });

  it("puts settings in the workspace group (communications absorbed into settings)", () => {
    const { sections } = buildSidebarModel("ADMIN", []);
    const workspace = sections.find((s) => s.group === "workspace");
    const h = hrefs(workspace!.items);
    expect(h).toContain("/settings");
    expect(h).not.toContain("/communications");
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
    expect(activeSuperGroup(model, "/documents")).toBe("documents");
    expect(activeSuperGroup(model, "/finance")).toBe("finance");
    expect(activeSuperGroup(model, "/inventory")).toBe("inventory");
    expect(activeSuperGroup(model, "/settings")).toBe("workspace");
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
    expect(PINNED_HREFS).toEqual(["/dashboard", "/jobs", "/clients", "/pos"]);
  });
});
