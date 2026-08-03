import Link from "next/link";

import { JobStatus } from "@/lib/job-status";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { routeLabel } from "@/lib/nav/registry";
import { prisma } from "@/lib/prisma";

import { DashboardHero } from "./shared";

/** Fallback dashboard for roles without a dedicated view. */
export async function SystemOverviewDashboard({ orgId }: { orgId: string }) {
  const [totalJobs, openJobs, completedJobs] = await Promise.all([
    prisma.job.count({ where: { orgId } }),
    prisma.job.count({
      where: {
        orgId,
        status: { in: filterSupportedJobStatuses(["RECEIVED", "DIAGNOSING", "REFERRED", "IN_EXTERNAL_REPAIR", "IN_REPAIR", "READY_FOR_PICKUP", "AWAITING_APPROVAL"]) as JobStatus[] },
      },
    }),
    prisma.job.count({ where: { orgId, status: "COMPLETED" } }),
  ]);

  return (
    <div className="space-y-4">
      <DashboardHero
        title="System Overview"
        summary={`${totalJobs} total jobs · ${openJobs} open · ${completedJobs} completed`}
        primaryHref="/jobs"
        primaryLabel={routeLabel("/jobs")}
        secondaryHref="/reports"
        secondaryLabel={routeLabel("/reports")}
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>}
      />

      {/* Quick-link row */}
      <div className="panel-shadow grid grid-cols-3 divide-x divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        {[
          { label: "Total Jobs",  value: String(totalJobs),    href: "/jobs",                                                                              color: "text-[var(--ink)]" },
          { label: "Open",        value: String(openJobs),     href: "/jobs?status=RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP",       color: "text-[var(--accent)]" },
          { label: "Completed",   value: String(completedJobs),href: "/jobs?status=COMPLETED",                                                              color: "text-emerald-600" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="flex flex-col items-center justify-center gap-0.5 py-3 transition hover:bg-[var(--panel-strong)]">
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">{item.label}</p>
          </Link>
        ))}
      </div>

    </div>
  );
}
