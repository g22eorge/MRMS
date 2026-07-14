export const PLATFORM_ROUTES = {
  home: "/platform",
  payments: "/platform/payments",
  audit: "/platform/audit",
  settings: "/platform/settings",
  org: (orgId: string) => `/platform/orgs/${orgId}`,
  /** Legacy stubs — redirect to canonical `/platform` tree. */
  legacyAdminHome: "/platform-admin",
  legacyAdminOrg: (orgId: string) => `/platform-admin/orgs/${orgId}`,
} as const;

export const PLATFORM_ADMIN_PERMISSION = "platform_admin";

export const PLATFORM_PLAN_CHIP: Record<string, string> = {
  STARTER: "bg-[var(--panel-strong)] text-[var(--ink-muted)] border-[var(--line)]",
  STANDARD: "bg-sky-500/10 text-sky-700 border-sky-400/30 dark:text-sky-400",
  GROWTH: "bg-amber-500/10 text-amber-700 border-amber-400/30 dark:text-amber-400",
  PREMIUM: "bg-violet-500/10 text-violet-700 border-violet-400/30 dark:text-violet-400",
  ENTERPRISE: "bg-purple-500/10 text-purple-700 border-purple-400/30 dark:text-purple-400",
};

export const PLATFORM_STATUS_CHIP: Record<string, string> = {
  TRIALING: "bg-blue-500/10 text-blue-700 border-blue-400/30 dark:text-blue-400",
  ACTIVE: "bg-emerald-500/10 text-emerald-700 border-emerald-400/30 dark:text-emerald-400",
  PAST_DUE: "bg-red-500/10 text-red-700 border-red-400/30 dark:text-red-400",
  CANCELLED: "bg-[var(--panel-strong)] text-[var(--ink-muted)] border-[var(--line)]",
};
