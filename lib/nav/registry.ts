/**
 * Canonical route registry — the single source of truth for every navigable
 * destination's href and label.
 *
 * Every nav surface (desktop sidebar, mobile bottom nav, /more page, command
 * palette, mobile quick actions, FAB, header tabs) must pull labels/hrefs from
 * here instead of hardcoding them. `label` is the one canonical name of a
 * page; `shortLabel` is an intentional compact variant for tight surfaces
 * (bottom-nav bar). Nothing else may rename a route.
 */

export type RouteDef = {
  href: string;
  label: string;
  /** Compact variant for the mobile bottom bar only. */
  shortLabel?: string;
};

const defs = [
  // Core
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/jobs/new", label: "New Job" },
  { href: "/intake", label: "Intake" },
  { href: "/technicians", label: "Technicians", shortLabel: "Techs" },
  { href: "/technicians/payouts", label: "My Payouts" },
  { href: "/field", label: "Field" },
  { href: "/field/new", label: "New Field Visit" },
  { href: "/complaints", label: "Complaints" },
  { href: "/warranty", label: "Warranty" },
  { href: "/clients", label: "Clients" },
  { href: "/service", label: "Service Hub" },

  // Stock & supply
  { href: "/inventory", label: "Inventory" },
  { href: "/inventory/locations", label: "Locations" },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/stock-counts", label: "Stock Counts" },
  { href: "/inventory/stock-counts/new", label: "New Stock Count" },
  { href: "/inventory/suppliers", label: "Suppliers" },
  { href: "/inventory/suppliers/new", label: "New Supplier" },
  { href: "/inventory/purchase-requests", label: "Purchase Requests" },
  { href: "/inventory/purchase-requests/new", label: "New Purchase Request" },
  { href: "/inventory/purchase-orders", label: "Purchase Orders" },
  { href: "/inventory/purchase-orders/new", label: "New Purchase Order" },
  { href: "/inventory/goods-received", label: "Goods Received" },
  { href: "/inventory/supplier-bills", label: "Supplier Bills" },
  { href: "/inventory/supplier-bills/new", label: "New Supplier Bill" },

  // Sales & POS
  { href: "/sales", label: "Sales CRM", shortLabel: "Sales" },
  { href: "/sales/campaigns", label: "Campaigns" },
  { href: "/sales/leads", label: "Leads" },
  { href: "/sales/quotations/new", label: "New Quotation" },
  { href: "/pos", label: "Point of Sale", shortLabel: "POS" },
  { href: "/targets", label: "Targets" },

  // Documents
  { href: "/documents", label: "Documents" },
  { href: "/documents/job-cards", label: "Job Cards" },
  { href: "/documents/quotations", label: "Quotations", shortLabel: "Quotes" },
  { href: "/documents/invoices", label: "Invoices" },
  { href: "/documents/delivery-notes", label: "Delivery Notes", shortLabel: "Delivery" },
  { href: "/documents/receipts", label: "Receipts" },
  { href: "/documents/credit-notes", label: "Credit Notes" },
  { href: "/documents/refunds", label: "Refunds" },
  { href: "/documents/templates", label: "Templates" },

  // Finance
  { href: "/finance", label: "Finance Hub" },
  { href: "/finance/expenses", label: "Expenses" },
  { href: "/finance/tax-rates", label: "Tax Rates" },
  { href: "/finance/recurring", label: "Recurring" },
  { href: "/finance/recurring-expenses", label: "Expense Schedules" },
  { href: "/finance/accounts", label: "Chart of Accounts" },
  { href: "/finance/journal", label: "Journal Entries" },
  { href: "/finance/bank", label: "Bank" },
  { href: "/finance/reports", label: "Financial Reports" },
  { href: "/finance/reports/pl", label: "P&L" },
  { href: "/finance/reports/balance-sheet", label: "Balance Sheet" },
  { href: "/finance/reports/cash-flow", label: "Cash Flow" },
  { href: "/finance/reports/trial-balance", label: "Trial Balance" },
  { href: "/finance/reports/vat", label: "VAT Summary" },
  { href: "/payout-followups", label: "Collections", shortLabel: "Collect" },
  { href: "/payables", label: "Payables" },

  // Analytics
  { href: "/reports", label: "Reports" },
  { href: "/ai-insights", label: "AI Insights" },

  // Communications
  { href: "/communications", label: "Communications" },

  // Account & admin
  { href: "/settings", label: "Settings" },
  { href: "/settings/users", label: "Users & Roles" },
  { href: "/settings/branches", label: "Branches" },
  { href: "/settings/groups", label: "Groups" },
  { href: "/settings/profile", label: "My Profile" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/branding", label: "Branding" },
  { href: "/settings/audit", label: "Audit Log" },
  { href: "/settings/ai", label: "AI Knowledge" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/notifications/outbox", label: "Outbox" },
  { href: "/settings/notifications/templates", label: "Templates" },
  { href: "/settings/notifications/whatsapp", label: "WhatsApp" },
  { href: "/settings/data-heal", label: "Backup & Restore" },
  { href: "/platform", label: "Platform Admin" },
  { href: "/more", label: "More" },
] as const satisfies readonly RouteDef[];

/** href → route definition. */
export const ROUTE: Record<string, RouteDef> = Object.fromEntries(
  defs.map((d) => [d.href, d]),
);

/** Canonical label for an href (falls back to the href itself in dev). */
export function routeLabel(href: string): string {
  return ROUTE[href]?.label ?? href;
}

/** Compact label for tight surfaces (bottom bar); falls back to label. */
export function routeShortLabel(href: string): string {
  const def = ROUTE[href];
  return def?.shortLabel ?? def?.label ?? href;
}
