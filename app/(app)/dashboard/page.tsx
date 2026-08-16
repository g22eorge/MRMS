export const dynamic = "force-dynamic";

import { getCurrentUserRole } from "@/lib/session";

import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { getOnboardingStatus } from "@/lib/onboarding-checklist";
import { AdminDashboard } from "./sections/AdminDashboard";
import { ExternalTechDashboard } from "./sections/ExternalTechDashboard";
import { FinanceDashboard } from "./sections/FinanceDashboard";
import { IntakeDashboard } from "./sections/IntakeDashboard";
import { InternalTechDashboard } from "./sections/InternalTechDashboard";
import { ManagerDashboard } from "./sections/ManagerDashboard";
import { OpsDashboard } from "./sections/OpsDashboard";
import { SalesDashboard } from "./sections/SalesDashboard";
import { SalesPosDashboard } from "./sections/SalesPosDashboard";
import {
  SalesCorporateDashboard,
  SalesManagerDashboard,
  SalesRetailDashboard,
} from "./sections/SalesRoleDashboards";
import { SystemOverviewDashboard } from "./sections/SystemOverviewDashboard";
import { TechFieldDashboard } from "./sections/TechFieldDashboard";
import { TechManagerDashboard } from "./sections/TechManagerDashboard";
import type { PeriodFilters } from "./sections/data";

type SearchParams = PeriodFilters;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { session, user } = await getCurrentUserRole();
  const permissionUser = { role: user.role, permissions: user.permissions };
  const filters = await searchParams;
  const period: "month" | "year" = filters.period === "year" ? "year" : "month";
  const orgId = user.orgId ?? null;

  // One dashboard design language: `calm-scope` remaps the app tokens
  // (--panel/--ink/--line/--accent…) to the shared --dc-* "calm" palette that
  // AdminDashboard already speaks, so every role dashboard renders on the same
  // flat, soft-bordered surface instead of the older crisper panel look. Same
  // mechanism the job-detail page uses (.jobdetail-cal). Structural layout stays
  // role-specific; only the visual vocabulary converges.
  const content = (() => {
    switch (user.role) {
      case "TECHNICIAN_EXTERNAL":
        return <ExternalTechDashboard userId={session.user.id} orgId={orgId} period={period} filters={filters} />;

      case "TECHNICIAN_INTERNAL":
        return <InternalTechDashboard userId={session.user.id} orgId={orgId ?? ""} permissionUser={permissionUser} period={period} filters={filters} />;

      case "TECH_MANAGER":
        return <TechManagerDashboard orgId={orgId} />;

      case "ADMIN":
        return <AdminDashboard userName={user.name} orgId={orgId} permissionUser={permissionUser} />;

      case "OPS":
        return <OpsDashboard orgId={orgId} period={period} filters={filters} />;

      case "FRONT_DESK":
      case "INTAKE":
        return <IntakeDashboard userId={session.user.id} orgId={orgId ?? ""} period={period} filters={filters} />;

      case "MANAGER":
        return <ManagerDashboard orgId={orgId} />;

      case "FINANCE":
        return <FinanceDashboard orgId={orgId ?? ""} />;

      case "SALES":
        return <SalesDashboard userId={user.id} orgId={orgId} />;

      case "SALES_MANAGER":
        return <SalesManagerDashboard orgId={orgId} />;

      case "SALES_CORPORATE":
        return <SalesCorporateDashboard userId={session.user.id} orgId={orgId} />;

      case "SALES_RETAIL":
        return <SalesRetailDashboard userId={session.user.id} orgId={orgId} />;

      case "SALES_POS":
        return <SalesPosDashboard userId={session.user.id} />;

      case "TECH_FIELD":
        return <TechFieldDashboard userId={session.user.id} />;

      default:
        return <SystemOverviewDashboard orgId={orgId ?? ""} />;
    }
  })();

  // First-run guidance. Derived from real data and self-retiring (all steps done,
  // or org older than 30 days), so it never needs dismissing and costs an
  // established workspace nothing.
  const onboarding = orgId ? await getOnboardingStatus(orgId).catch(() => null) : null;

  return (
    <div className="calm-scope">
      {onboarding ? <OnboardingChecklist status={onboarding} /> : null}
      {content}
    </div>
  );
}
