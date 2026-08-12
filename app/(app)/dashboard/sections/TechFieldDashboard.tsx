import Link from "next/link";

import { StickyKpiRow } from "@/components/mobile/StickyKpiRow";
import { JobStatus } from "@/lib/job-status";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { routeLabel } from "@/lib/nav/registry";
import { prisma } from "@/lib/prisma";

import { DashboardHero } from "./shared";

export async function TechFieldDashboard({ userId }: { userId: string }) {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [assignedJobs, completedToday] = await Promise.all([
    prisma.job.count({
      where: {
        assignedToId: userId,
        status: {
          in: filterSupportedJobStatuses(["RECEIVED", "DIAGNOSING", "IN_REPAIR"]) as JobStatus[],
        },
      },
    }),
    prisma.job.count({
      where: {
        assignedToId: userId,
        status: "COMPLETED",
        completedAt: { gte: todayStart },
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <DashboardHero
        title="Field Technician"
        summary="View your assigned jobs and complete field visits."
        primaryHref="/jobs"
        primaryLabel={routeLabel("/jobs")}
      />

      <StickyKpiRow
        items={[
          { label: "Assigned", value: String(assignedJobs), href: "/jobs", tone: "brand" },
          { label: "Completed Today", value: String(completedToday), href: "/jobs?status=COMPLETED", tone: "success" },
        ]}
      />

      <div className="grid gap-3 grid-cols-2">
        <Link href="/jobs" className="dc-card px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Assigned Jobs</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{assignedJobs}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">View queue →</p>
        </Link>
        <Link href="/jobs?status=COMPLETED" className="dc-card px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Completed Today</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{completedToday}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">View completed →</p>
        </Link>
      </div>
    </div>
  );
}
