/**
 * Single source of truth mapping nav hrefs → org module keys.
 *
 * Consumed by the desktop sidebar model (lib/nav/sidebar-model.ts) and the
 * mobile bottom nav (components/layout/BottomNav.tsx). Previously each kept
 * its own near-identical copy that drifted independently.
 */
export const HREF_MODULE: Record<string, string> = {
  "/jobs": "JOBS",
  "/intake": "JOBS",
  "/technicians": "JOBS",
  "/clients": "JOBS",
  "/payout-followups": "JOBS",
  "/complaints": "COMPLAINTS",
  "/field": "FIELD",
  "/inventory": "INVENTORY",
  "/inventory/locations": "INVENTORY",
  "/inventory/transfers": "INVENTORY",
  "/inventory/stock-counts": "INVENTORY",
  "/procurement": "PURCHASE_ORDERS",
  "/inventory/purchase-requests": "PURCHASE_ORDERS",
  "/inventory/purchase-orders": "PURCHASE_ORDERS",
  "/inventory/goods-received": "PURCHASE_ORDERS",
  "/inventory/supplier-bills": "PURCHASE_ORDERS",
  "/inventory/suppliers": "PURCHASE_ORDERS",
  "/finance": "INVOICING",
  "/documents/job-cards": "INVOICING",
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
  "/targets": "TARGETS",
};

/** True when the href's module (if any) is enabled, or when no module set is provided. */
export function hrefModuleAllowed(href: string, enabledModules?: Set<string>): boolean {
  if (!enabledModules) return true;
  const mod = HREF_MODULE[href];
  return !mod || enabledModules.has(mod);
}
