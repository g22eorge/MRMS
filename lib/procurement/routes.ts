import type { HubTab } from "@/components/shared/HubTabs";

// Buying pages cross-nav. These three live under /inventory/* and each is also
// a sidebar shortcut; the tab bar just links them in-context. The old
// /procurement control desk (and its Overview tab) was removed as redundant —
// Orders and Bills are sidebar items and the money roll-up wasn't earning its
// keep.
export const PROCUREMENT_TABS: HubTab[] = [
  { href: "/inventory/purchase-orders", label: "Orders" },
  { href: "/inventory/supplier-bills", label: "Bills" },
  { href: "/inventory/goods-received", label: "Received" },
];
