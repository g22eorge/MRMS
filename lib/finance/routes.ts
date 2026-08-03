// Finance hub navigation — mirrors lib/documents/routes.ts so every finance page
// shares one tabbed shell instead of feeling like separate modules.

export const FINANCE_ROUTES = {
  home: "/finance",
  reports: "/finance/reports",
  expenses: "/finance/expenses",
  bank: "/finance/bank",
  recurring: "/finance/recurring",
  taxRates: "/finance/tax-rates",
  accounts: "/finance/accounts",
  journal: "/finance/journal",
} as const;

export type FinanceNavKey =
  | "overview"
  | "reports"
  | "expenses"
  | "bank"
  | "recurring"
  | "tax_rates"
  | "accounts"
  | "journal";

export const FINANCE_NAV: Array<{ key: FinanceNavKey; href: string; label: string }> = [
  { key: "overview", href: FINANCE_ROUTES.home, label: "Overview" },
  { key: "reports", href: FINANCE_ROUTES.reports, label: "Reports" },
  { key: "expenses", href: FINANCE_ROUTES.expenses, label: "Expenses" },
  { key: "bank", href: FINANCE_ROUTES.bank, label: "Bank" },
  { key: "recurring", href: FINANCE_ROUTES.recurring, label: "Recurring" },
  { key: "tax_rates", href: FINANCE_ROUTES.taxRates, label: "Tax Rates" },
  { key: "accounts", href: FINANCE_ROUTES.accounts, label: "Accounts" },
  { key: "journal", href: FINANCE_ROUTES.journal, label: "Journal" },
];

const FINANCE_ROLES = new Set(["ADMIN", "MANAGER", "OPS", "FINANCE"]);

/** Tabs visible in the finance hub for a role (each page still enforces its own perms). */
export function financeNavForRole(role: string) {
  return FINANCE_ROLES.has(role) ? FINANCE_NAV : [];
}

export function canAccessFinanceHub(role: string) {
  return financeNavForRole(role).length > 0;
}
