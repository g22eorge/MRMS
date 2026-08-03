import type { HubTab } from "@/components/shared/HubTabs";

// Procurement (buying) hub tabs. The sub-pages live under /inventory/* for
// historical reasons; the Overview is the /procurement control desk.
export const PROCUREMENT_TABS: HubTab[] = [
  { href: "/procurement", label: "Overview", exact: true },
  { href: "/inventory/purchase-requests", label: "Requests" },
  { href: "/inventory/purchase-orders", label: "Purchase Orders" },
  { href: "/inventory/supplier-bills", label: "Bills" },
  { href: "/inventory/goods-received", label: "Received" },
];
