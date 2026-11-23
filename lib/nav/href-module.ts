/**
 * Single source of truth mapping nav hrefs → org module keys.
 *
 * Consumed by the desktop sidebar model (lib/nav/sidebar-model.ts) and the
 * mobile bottom nav (components/layout/BottomNav.tsx). Previously each kept
 * its own near-identical copy that drifted independently.
 */
// "/clients" is deliberately absent: every business has customers, whichever
// modules it chose. It was filed under JOBS, so a shop with point of sale and
// invoicing but no repairs had no customer list.
export const HREF_MODULE: Record<string, string> = {
  "/jobs": "JOBS",
  "/intake": "JOBS",
  "/technicians": "JOBS",
  "/payout-followups": "JOBS",
  "/technicians/payouts": "JOBS",
  "/service": "JOBS",
  "/complaints": "COMPLAINTS",
  "/warranty": "JOBS",
  "/field": "FIELD",
  "/inventory": "INVENTORY",
  "/inventory/locations": "INVENTORY",
  "/inventory/transfers": "INVENTORY",
  "/inventory/stock-counts": "INVENTORY",
  "/inventory/purchase-requests": "PURCHASE_ORDERS",
  "/inventory/purchase-orders": "PURCHASE_ORDERS",
  "/inventory/goods-received": "PURCHASE_ORDERS",
  "/inventory/supplier-bills": "PURCHASE_ORDERS",
  "/inventory/suppliers": "PURCHASE_ORDERS",
  "/finance": "INVOICING",
  "/documents/job-cards": "JOBS",
  "/documents/quotations": "INVOICING",
  "/documents/invoices": "INVOICING",
  "/documents/receipts": "INVOICING",
  "/documents/delivery-notes": "INVOICING",
  "/documents/credit-notes": "INVOICING",
  "/documents/refunds": "INVOICING",
  "/pos": "POS",
  "/reports": "REPORTS",
  "/ai-insights": "REPORTS",
  "/sales": "SALES",
  "/sales/campaigns": "SALES",
  "/targets": "TARGETS",
};

/** True when the href's module (if any) is enabled, or when no module set is provided. */
export function hrefModuleAllowed(href: string, enabledModules?: Set<string>): boolean {
  if (!enabledModules) return true;
  const mod = HREF_MODULE[href];
  return !mod || enabledModules.has(mod);
}
