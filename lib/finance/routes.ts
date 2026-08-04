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

// Per-tab role gating, mirroring lib/documents/routes.ts. The everyday finance
// tabs are open to all finance-capable roles; the accountant-only surfaces
// (Accounts / Journal — the chart of accounts and the raw double-entry ledger)
// are hidden from OPS so a non-accountant operator never sees them.
const EVERYDAY_FINANCE_ROLES = ["ADMIN", "MANAGER", "OPS", "FINANCE"] as const;
const ACCOUNTANT_ROLES = ["ADMIN", "MANAGER", "FINANCE"] as const;

export const FINANCE_NAV: Array<{ key: FinanceNavKey; href: string; label: string; roles: readonly string[] }> = [
  { key: "overview", href: FINANCE_ROUTES.home, label: "Overview", roles: EVERYDAY_FINANCE_ROLES },
  { key: "reports", href: FINANCE_ROUTES.reports, label: "Reports", roles: EVERYDAY_FINANCE_ROLES },
  { key: "expenses", href: FINANCE_ROUTES.expenses, label: "Expenses", roles: EVERYDAY_FINANCE_ROLES },
  { key: "bank", href: FINANCE_ROUTES.bank, label: "Bank", roles: EVERYDAY_FINANCE_ROLES },
  { key: "recurring", href: FINANCE_ROUTES.recurring, label: "Recurring", roles: EVERYDAY_FINANCE_ROLES },
  { key: "tax_rates", href: FINANCE_ROUTES.taxRates, label: "Tax Rates", roles: EVERYDAY_FINANCE_ROLES },
  { key: "accounts", href: FINANCE_ROUTES.accounts, label: "Accounts", roles: ACCOUNTANT_ROLES },
  { key: "journal", href: FINANCE_ROUTES.journal, label: "Journal", roles: ACCOUNTANT_ROLES },
];

/** Tabs visible in the finance hub for a role (each page still enforces its own perms). */
export function financeNavForRole(role: string) {
  return FINANCE_NAV.filter((item) => item.roles.includes(role));
}

export function canAccessFinanceHub(role: string) {
  return financeNavForRole(role).length > 0;
}

/** Accountant-only finance surfaces (chart of accounts, raw journal). */
export function canAccessAccountantFinance(role: string) {
  return (ACCOUNTANT_ROLES as readonly string[]).includes(role);
}
