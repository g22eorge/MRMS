import { Role } from "@prisma/client";

import { can } from "@/lib/permissions";
import { hrefModuleAllowed } from "@/lib/nav/href-module";
import { routeLabel } from "@/lib/nav/registry";

// ── nav groups (source taxonomy) ───────────────────────────────────────────────
// The eight fine-grained groups still describe each item's home. For a calmer
// sidebar they are folded into a handful of collapsible super-groups below, with
// the daily-driver items pinned above the groups entirely.

export type NavGroup =
  | "overview"
  | "service"
  | "stock"
  | "customers"
  | "documents"
  | "communications"
  | "finance"
  | "personal";

export type SuperGroup = "service" | "sales" | "finance" | "inventory" | "workspace";

export type NavItem = {
  href: string;
  label: string;
  group: NavGroup;
  roles: "all" | readonly Role[];
};

export const NAV: readonly NavItem[] = [
  // Overview
  { href: "/dashboard", label: routeLabel("/dashboard"), group: "overview", roles: "all" },

  // Service — daily items + hub for management
  { href: "/jobs", label: routeLabel("/jobs"), group: "service", roles: "all" },
  { href: "/intake", label: routeLabel("/intake"), group: "service", roles: ["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "FRONT_DESK", "TECHNICIAN_INTERNAL", "SALES_MANAGER"] },
  { href: "/service", label: routeLabel("/service"), group: "service", roles: ["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "FRONT_DESK"] },

  // Inventory & Supply — the two hubs only. Purchase requests, purchase orders
  // and the stock ops hub are reached from inside these pages (they link to each
  // other), so they no longer clutter the sidebar as separate top-level rows.
  { href: "/inventory", label: routeLabel("/inventory"), group: "stock", roles: ["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "TECHNICIAN_INTERNAL"] },
  { href: "/procurement", label: routeLabel("/procurement"), group: "stock", roles: ["ADMIN", "MANAGER", "TECH_MANAGER", "OPS"] },

  // Customers
  { href: "/clients", label: routeLabel("/clients"), group: "customers", roles: ["ADMIN", "MANAGER", "OPS", "FRONT_DESK", "SALES", "SALES_MANAGER", "SALES_CORPORATE", "SALES_RETAIL", "FINANCE"] },
  { href: "/sales", label: routeLabel("/sales"), group: "customers", roles: ["ADMIN", "MANAGER", "OPS", "SALES", "SALES_MANAGER", "SALES_CORPORATE", "SALES_RETAIL", "TECH_MANAGER"] },
  { href: "/sales/campaigns", label: routeLabel("/sales/campaigns"), group: "customers", roles: ["ADMIN", "MANAGER", "OPS", "SALES", "SALES_MANAGER"] },
  { href: "/pos", label: routeLabel("/pos"), group: "customers", roles: ["ADMIN", "MANAGER", "OPS", "FRONT_DESK", "SALES", "SALES_MANAGER", "SALES_RETAIL", "SALES_POS"] },

  // Documents — single hub entry; the in-page tabs cover job cards,
  // quotations, invoices, receipts, and the rest (no sidebar duplication).
  { href: "/documents", label: routeLabel("/documents"), group: "documents", roles: ["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "FRONT_DESK", "SALES", "SALES_MANAGER", "SALES_CORPORATE", "SALES_RETAIL", "FINANCE", "TECHNICIAN_INTERNAL"] },

  // Communications is absorbed into Settings → Communications (no sidebar row).

  // Finance
  { href: "/finance", label: routeLabel("/finance"), group: "finance", roles: ["ADMIN", "MANAGER", "OPS", "FINANCE"] },
  { href: "/technicians/payouts", label: routeLabel("/technicians/payouts"), group: "finance", roles: ["TECHNICIAN_EXTERNAL"] },

  // Account
  { href: "/settings", label: routeLabel("/settings"), group: "personal", roles: "all" },
] as const;

// ── super-group folding ─────────────────────────────────────────────────────────

const SUPER_GROUP: Record<NavGroup, SuperGroup> = {
  overview: "service", // dashboard is pinned, so this mapping only matters if it ever leaves the pinned set
  service: "service",
  customers: "sales",
  documents: "finance", // quotations/invoices/receipts are billing output
  finance: "finance",
  stock: "inventory",
  communications: "workspace",
  personal: "workspace",
};

export const SUPER_GROUP_LABEL: Record<SuperGroup, string> = {
  service: "Service",
  sales: "Sales",
  finance: "Finance",
  inventory: "Inventory",
  workspace: "Workspace",
};

export const SUPER_GROUP_ORDER: readonly SuperGroup[] = ["service", "sales", "finance", "inventory", "workspace"] as const;

/** Daily-driver destinations, pinned above the groups in this priority order. */
export const PINNED_HREFS: readonly string[] = ["/dashboard", "/jobs", "/clients", "/pos"] as const;

// ── role ordering ────────────────────────────────────────────────────────────────

const roleOrder: Partial<Record<Role, readonly string[]>> = {
  ADMIN: [
    "/dashboard",
    "/jobs", "/intake", "/field", "/technicians", "/complaints",
    "/inventory", "/inventory/locations", "/inventory/transfers", "/inventory/stock-counts",
    "/inventory/suppliers", "/inventory/purchase-requests", "/inventory/purchase-orders", "/inventory/goods-received", "/inventory/supplier-bills",
    "/clients", "/sales", "/sales/campaigns", "/pos",
    "/documents/job-cards", "/documents/quotations", "/documents/invoices", "/documents/receipts", "/documents/delivery-notes", "/documents/credit-notes", "/documents/refunds", "/documents/templates",
    "/finance/expenses", "/finance/tax-rates", "/finance/recurring", "/finance/accounts", "/finance/journal", "/finance/bank", "/finance/reports/pl", "/finance/reports/balance-sheet", "/pos/shifts", "/targets", "/reports", "/ai-insights", "/payout-followups",
    "/settings",
  ],
  MANAGER: [
    "/dashboard",
    "/jobs", "/intake", "/field", "/technicians", "/complaints",
    "/inventory", "/inventory/locations", "/inventory/transfers", "/inventory/stock-counts",
    "/inventory/suppliers", "/inventory/purchase-requests", "/inventory/purchase-orders", "/inventory/goods-received", "/inventory/supplier-bills",
    "/clients", "/sales", "/sales/campaigns", "/pos",
    "/documents/job-cards", "/documents/quotations", "/documents/invoices", "/documents/receipts", "/documents/delivery-notes", "/documents/credit-notes", "/documents/refunds", "/documents/templates",
    "/finance/expenses", "/finance/tax-rates", "/finance/recurring", "/finance/accounts", "/finance/journal", "/finance/bank", "/finance/reports/pl", "/finance/reports/balance-sheet", "/pos/shifts", "/targets", "/reports", "/ai-insights", "/payout-followups",
    "/settings",
  ],
  TECH_MANAGER: [
    "/dashboard",
    "/jobs", "/intake", "/field", "/technicians", "/complaints",
    "/inventory", "/inventory/locations", "/inventory/transfers", "/inventory/stock-counts",
    "/inventory/suppliers", "/inventory/purchase-requests", "/inventory/purchase-orders", "/inventory/goods-received", "/inventory/supplier-bills",
    "/documents/job-cards", "/documents/quotations", "/documents/invoices", "/targets", "/payout-followups",
    "/settings",
  ],
  OPS: [
    "/dashboard",
    "/jobs", "/intake", "/field", "/technicians", "/complaints",
    "/inventory", "/inventory/locations", "/inventory/transfers", "/inventory/stock-counts",
    "/inventory/suppliers", "/inventory/purchase-requests", "/inventory/purchase-orders", "/inventory/goods-received", "/inventory/supplier-bills",
    "/clients", "/sales", "/sales/campaigns", "/pos",
    "/documents/job-cards", "/documents/quotations", "/documents/invoices", "/documents/receipts", "/documents/delivery-notes", "/documents/credit-notes", "/documents/refunds", "/documents/templates",
    "/finance/expenses", "/finance/recurring", "/finance/reports/pl", "/finance/reports/balance-sheet", "/pos/shifts", "/targets", "/reports", "/ai-insights", "/payout-followups",
    "/settings",
  ],
  FINANCE: [
    "/dashboard",
    "/clients",
    "/documents/invoices", "/documents/credit-notes", "/documents/refunds",
    "/finance/expenses", "/finance/recurring", "/finance/accounts", "/finance/journal", "/finance/bank", "/finance/reports/pl", "/finance/reports/balance-sheet", "/pos/shifts", "/targets", "/reports", "/ai-insights", "/payout-followups",
    "/settings",
  ],
  SALES: [
    "/dashboard",
    "/clients", "/sales", "/sales/campaigns", "/pos",
    "/documents/quotations", "/documents/receipts",
    "/settings",
  ],
  FRONT_DESK: [
    "/dashboard",
    "/jobs", "/intake", "/technicians",
    "/clients", "/pos",
    "/documents/job-cards", "/documents/receipts", "/documents/delivery-notes",
    "/settings",
  ],
  TECHNICIAN_INTERNAL: [
    "/dashboard",
    "/jobs", "/intake", "/technicians",
    "/inventory",
    "/documents/job-cards", "/documents/quotations",
    "/settings",
  ],
  TECHNICIAN_EXTERNAL: [
    "/dashboard",
    "/jobs", "/technicians",
    "/technicians/payouts",
    "/settings",
  ],
  INTAKE: ["/dashboard", "/jobs", "/intake", "/technicians", "/clients", "/documents/job-cards", "/settings"],
  SALES_MANAGER: ["/dashboard", "/jobs", "/intake", "/field", "/technicians", "/clients", "/sales", "/sales/campaigns", "/pos", "/documents/job-cards", "/documents/quotations", "/documents/invoices", "/targets", "/reports", "/ai-insights", "/payout-followups", "/settings"],
  SALES_CORPORATE: ["/dashboard", "/jobs", "/clients", "/sales", "/documents/quotations", "/documents/invoices", "/settings"],
  SALES_RETAIL: ["/dashboard", "/jobs", "/clients", "/sales", "/pos", "/documents/quotations", "/documents/receipts", "/settings"],
  SALES_POS: ["/dashboard", "/pos", "/settings"],
  TECH_FIELD: ["/dashboard", "/jobs", "/field", "/settings"],
};

// ── helpers ───────────────────────────────────────────────────────────────────────

export function isVisible(role: Role, rule: "all" | readonly Role[]) {
  return rule === "all" ? true : (rule as readonly Role[]).includes(role);
}

export function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

export function activeHrefForPath(pathname: string, hrefs: readonly string[]) {
  let best: string | null = null;
  for (const href of hrefs) {
    if (!isActive(pathname, href)) continue;
    if (!best || href.length > best.length) best = href;
  }
  return best;
}

type PermissionUser = Parameters<typeof can.viewClientInfo>[0];

export function orderedNavForRole(role: Role, permissions: string[], enabledModules?: Set<string>): NavItem[] {
  const moduleAllowed = (href: string) => hrefModuleAllowed(href, enabledModules);

  const visible = NAV.filter(
    (item) => isVisible(role, item.roles) && moduleAllowed(item.href),
  );
  const permissionUser = { role, permissions } as PermissionUser;

  function ensureItem(href: string) {
    if (!moduleAllowed(href)) return;
    if (!visible.some((i) => i.href === href)) {
      const found = NAV.find((i) => i.href === href);
      if (found) visible.push(found);
    }
  }
  if (can.viewClientInfo(permissionUser)) {
    ensureItem("/intake");
    ensureItem("/clients");
  }
  if (can.viewAccountsSummary(permissionUser)) ensureItem("/reports");
  if (can.viewFinancials(permissionUser)) ensureItem("/documents");
  if (can.reviewExternalBills(permissionUser) || can.approveInvoices(permissionUser)) ensureItem("/payout-followups");
  if (can.generateJobCards(permissionUser)) ensureItem("/documents");

  const ordered = roleOrder[role] ?? visible.map((item) => item.href);
  const ranking = new Map(ordered.map((href, index) => [href, index]));
  return [...visible].sort((a, b) => (ranking.get(a.href) ?? 99) - (ranking.get(b.href) ?? 99));
}

export type SidebarSection = {
  group: SuperGroup;
  label: string;
  items: NavItem[];
};

export type SidebarModel = {
  /** Daily-driver items shown flat above the collapsible groups. */
  pinned: NavItem[];
  /** Collapsible super-groups, in display order, non-empty only. */
  sections: SidebarSection[];
};

/**
 * Build the calm sidebar layout for a role: a small pinned set of daily items
 * followed by a few collapsible super-groups. Role/permission/module visibility
 * is delegated to {@link orderedNavForRole} so behavior matches the old sidebar.
 */
export function buildSidebarModel(role: Role, permissions: string[], enabledModules?: Set<string>): SidebarModel {
  const ordered = orderedNavForRole(role, permissions, enabledModules);
  const orderedByHref = new Map(ordered.map((item) => [item.href, item]));

  // Pinned items in PINNED_HREFS priority order, only those visible for this role.
  const pinned: NavItem[] = [];
  const pinnedSet = new Set<string>();
  for (const href of PINNED_HREFS) {
    const item = orderedByHref.get(href);
    if (item) {
      pinned.push(item);
      pinnedSet.add(href);
    }
  }

  // Remaining items grouped into super-groups, preserving ordered() order.
  const bucket = new Map<SuperGroup, NavItem[]>();
  for (const item of ordered) {
    if (pinnedSet.has(item.href)) continue;
    const sg = SUPER_GROUP[item.group];
    const list = bucket.get(sg) ?? [];
    list.push(item);
    bucket.set(sg, list);
  }

  const sections: SidebarSection[] = SUPER_GROUP_ORDER
    .map((group) => ({ group, label: SUPER_GROUP_LABEL[group], items: bucket.get(group) ?? [] }))
    .filter((section) => section.items.length > 0);

  return { pinned, sections };
}

/** Which super-group (if any) owns the currently active path. */
export function activeSuperGroup(model: SidebarModel, activeHref: string | null): SuperGroup | null {
  if (!activeHref) return null;
  for (const section of model.sections) {
    if (section.items.some((item) => item.href === activeHref)) return section.group;
  }
  return null;
}
