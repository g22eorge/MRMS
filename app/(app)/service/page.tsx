export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/org-context";
import { orgDb } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServiceHubNav } from "@/components/service/ServiceHubNav";

export default async function ServiceHubPage() {
  const { user, orgId } = await requireOrgSession();
  if (!["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "FRONT_DESK"].includes(user.role)) {
    redirect("/dashboard");
  }

  const db = orgDb(orgId);
  const [openJobs, pendingIntake] = await Promise.all([
    db.job.count({ where: { orgId, status: { notIn: ["COMPLETED", "CLOSED"] } } }).catch(() => null),
    db.repairRequest.count({ where: { orgId, requestStatus: { in: ["PENDING_INTAKE", "PENDING_FRONT_DESK"] } } }).catch(() => null),
  ]);

  return (
    <div className="space-y-4 pb-24 lg:pb-6">

      <ServiceHubNav />

      <PageHeader
        eyebrow="Service"
        title="Service Hub"
        description="Field visits, technicians, and complaints"
        kpis={[
          { label: "Open Jobs", value: openJobs ?? "—", sub: "in progress", tone: "accent", href: "/jobs" },
          { label: "Pending Intake", value: pendingIntake ?? "—", sub: "awaiting intake", tone: (pendingIntake ?? 0) > 0 ? "warn" : "neutral", href: "/intake" },
        ]}
        actions={
          <>
            <Link
              href="/jobs"
              className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]"
            >
              ← Jobs
            </Link>
            <Link
              href="/intake"
              className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]"
            >
              Intake
              {pendingIntake !== null && pendingIntake > 0 && (
                <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">{pendingIntake}</span>
              )}
            </Link>
          </>
        }
      />

    </div>
  );
}
