import type { HubTab } from "@/components/shared/HubTabs";

// Inventory (stock) hub tabs. The buying side (POs, requests, bills, GRNs) lives
// under the Procurement hub even though those routes are physically under
// /inventory/* — see lib/procurement/routes.ts.
export const INVENTORY_TABS: HubTab[] = [
  { href: "/inventory", label: "Items", exact: true },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/stock-counts", label: "Stock Counts" },
  { href: "/inventory/locations", label: "Locations" },
  { href: "/inventory/suppliers", label: "Suppliers" },
];
