import type { HubTab } from "@/components/shared/HubTabs";

// Inventory hub tabs — only for destinations the sidebar does not carry.
//
// Stock Counts and Suppliers were here as well as in the sidebar, so the same
// page had two routes to it a few centimetres apart, neither aware of the
// other. The sidebar wins: it is the navigation the user learns once and uses
// everywhere, and a tab bar that half-mirrors it teaches that neither can be
// trusted to be complete.
//
// Transfers and Locations stay because the rendered sidebar does not show them
// — verified against the live DOM rather than the registry, which lists both
// while the sidebar model does not surface them. Removing these would have left
// two pages reachable only by typing the URL.
export const INVENTORY_TABS: HubTab[] = [
  { href: "/inventory", label: "Items", exact: true },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/locations", label: "Locations" },
];
