import type { HubTab } from "@/components/shared/HubTabs";

// Procurement (buying) hub tabs. The sub-pages live under /inventory/* for
// historical reasons; the Overview is the /procurement control desk. The
// requisition (purchase-requests) stage was dropped from the desk — direct
// PO → receive → bill only — so it's no longer a tab here.
export const PROCUREMENT_TABS: HubTab[] = [
  { href: "/procurement", label: "Overview", exact: true },
  { href: "/inventory/purchase-orders", label: "Orders" },
  { href: "/inventory/supplier-bills", label: "Bills" },
  { href: "/inventory/goods-received", label: "Received" },
];
