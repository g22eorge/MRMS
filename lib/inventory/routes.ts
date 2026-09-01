import type { HubTab } from "@/components/shared/HubTabs";

/**
 * The Inventory hub, arranged like Documents.
 *
 * This used to be three tabs, because the sidebar carried six of these
 * destinations and a tab bar that half-mirrors the sidebar teaches that neither
 * can be trusted to be complete. The resolution then was to let the sidebar
 * win; the resolution now is the opposite, and the reason is that Documents
 * demonstrates the better shape: one section entry in the sidebar, and every
 * destination inside it reachable as a tab from any of its sibling pages.
 *
 * Ordered by the way stock actually moves through the business rather than
 * alphabetically — you buy it, receive it, get billed for it, then count,
 * move and locate it. Someone learning the module can read the tab bar as the
 * process.
 *
 * The sidebar's six inventory entries are removed to match; see
 * lib/nav/sidebar-model.ts. Only "/inventory" remains there, which is the
 * section, not a page competing with its own children.
 */
export const INVENTORY_TABS: HubTab[] = [
  { href: "/inventory", label: "Items", exact: true },
  { href: "/inventory/suppliers", label: "Suppliers" },
  { href: "/inventory/purchase-requests", label: "Requests" },
  { href: "/inventory/purchase-orders", label: "Purchase Orders" },
  { href: "/inventory/goods-received", label: "Goods Received" },
  { href: "/inventory/supplier-bills", label: "Supplier Bills" },
  { href: "/inventory/stock-counts", label: "Stock Counts" },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/locations", label: "Locations" },
];
