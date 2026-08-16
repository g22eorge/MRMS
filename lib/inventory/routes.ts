import type { HubTab } from "@/components/shared/HubTabs";

// Inventory (stock) hub tabs — the sub-nav for the stock pages, and the only
// home for Transfers and Locations (which aren't sidebar shortcuts). The buying
// pages (purchase orders, goods received, supplier bills) are reached straight
// from the sidebar now; their old tab bar was removed as sidebar duplication.
export const INVENTORY_TABS: HubTab[] = [
  { href: "/inventory", label: "Items", exact: true },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/stock-counts", label: "Stock Counts" },
  { href: "/inventory/locations", label: "Locations" },
  { href: "/inventory/suppliers", label: "Suppliers" },
];
