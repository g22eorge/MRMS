export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/org-context";
import { orgDb } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServiceHubNav } from "@/components/service/ServiceHubNav";
import { formatEATTime } from "@/lib/date-eat";
import { formatMoneyCompact, getAppCurrency } from "@/lib/currency";

const ACTIVE_VISIT_STATUSES = ["SCHEDULED", "EN_ROUTE", "ARRIVED"] as const;
const OPEN_COMPLAINT_STATUSES = ["RECEIVED", "ACKNOWLEDGED", "INVESTIGATING"] as const;
const PAID_PATH_STATUSES = ["COMPLETED", "DELIVERED"] as const;

export default async function ServiceHubPage() {
  const { user, orgId } = await requireOrgSession();
  if (!["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "FRONT_DESK"].includes(user.role)) {
    redirect("/dashboard");
  }

  const db = orgDb(orgId);
  const currency = getAppCurrency();

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const visitsTodayWhere = {
    orgId,
    status: { in: [...ACTIVE_VISIT_STATUSES] },
    scheduledAt: { gte: dayStart, lt: dayEnd },
  };
  const openComplaintsWhere = {
    orgId,
    status: { in: [...OPEN_COMPLAINT_STATUSES] },
  };
  const unpaidPayoutWhere = {
    orgId,
    repairPath: "EXTERNAL" as const,
    externalPaid: false,
    status: { in: [...PAID_PATH_STATUSES] },
  };

  const [
    openJobs,
    pendingIntake,
    visitsTodayCount,
    openComplaintsCount,
    unpaidPayouts,
    todaysVisits,
    openComplaints,
  ] = await Promise.all([
    db.job.count({ where: { orgId, status: { notIn: ["COMPLETED", "CLOSED"] } } }).catch(() => null),
    db.repairRequest.count({ where: { orgId, requestStatus: { in: ["PENDING_INTAKE", "PENDING_FRONT_DESK"] } } }).catch(() => null),
    db.fieldVisit.count({ where: visitsTodayWhere }).catch(() => null),
    db.complaint.count({ where: openComplaintsWhere }).catch(() => null),
    db.job.aggregate({
      where: unpaidPayoutWhere,
      _count: true,
      _sum: { externalTechFee: true },
    }).catch(() => ({ _count: 0, _sum: { externalTechFee: 0 } })),
    db.fieldVisit.findMany({
      where: visitsTodayWhere,
      select: {
        id: true,
        type: true,
        status: true,
        scheduledAt: true,
        address: true,
        contactName: true,
        assignedTo: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 6,
    }).catch(() => []),
    db.complaint.findMany({
      where: openComplaintsWhere,
      select: {
        id: true,
        complaintNumber: true,
        status: true,
        category: true,
        clientName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }).catch(() => []),
  ]);

  const payoutCount = (unpaidPayouts as { _count: number })._count ?? 0;
  const payoutOwed = (unpaidPayouts as { _sum: { externalTechFee: number | null } })._sum.externalTechFee ?? 0;

  return (
    <div className="space-y-4 pb-24 lg:pb-6">

      <ServiceHubNav />

      <PageHeader
        title="Service Hub"
        description="Field visits, technicians, and complaints"
        kpis={[
          { label: "Open Jobs", value: openJobs ?? "—", sub: "in progress", tone: "accent", href: "/jobs" },
          { label: "Pending Intake", value: pendingIntake ?? "—", sub: "awaiting intake", tone: (pendingIntake ?? 0) > 0 ? "warn" : "neutral", href: "/intake" },
          { label: "Visits Today", value: visitsTodayCount ?? "—", sub: "scheduled today", tone: (visitsTodayCount ?? 0) > 0 ? "accent" : "neutral", href: "/field" },
          { label: "Open Complaints", value: openComplaintsCount ?? "—", sub: "need attention", tone: (openComplaintsCount ?? 0) > 0 ? "warn" : "neutral", href: "/complaints" },
          {
            label: "Unpaid Payouts",
            value: payoutCount,
            sub: payoutCount > 0 ? `${formatMoneyCompact(payoutOwed, currency)} owed` : "all settled",
            tone: payoutCount > 0 ? "crit" : "neutral",
            muted: payoutCount === 0,
            href: "/jobs",
          },
        ]}
        actions={
          <>
            <Link
              href="/jobs"
              className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]"
            >
              ← Jobs
            </Link>
            <Link
              href="/intake"
              className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]"
            >
              Intake
              {pendingIntake !== null && pendingIntake > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[0.625rem] font-bold text-white leading-none">{pendingIntake}</span>
              )}
            </Link>
          </>
        }
      />

      {/* ── At-a-glance: today's field visits + open complaints ── */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="dc-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Today&apos;s Field Visits</p>
            <Link href="/field" className="text-xs font-semibold text-[var(--accent)] hover:underline">All visits</Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {todaysVisits.map((visit) => (
              <Link key={visit.id} href={`/field/${visit.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--panel-strong)]/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">
                    {visit.contactName ?? visit.address}
                  </p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">
                    {visit.type.replace(/_/g, " ").toLowerCase()}
                    {visit.assignedTo?.name ? ` · ${visit.assignedTo.name}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black tabular-nums text-[var(--ink)]">{formatEATTime(visit.scheduledAt)}</p>
                  <p className="text-[0.6875rem] text-[var(--ink-muted)]">{visit.status.replace(/_/g, " ").toLowerCase()}</p>
                </div>
              </Link>
            ))}
            {todaysVisits.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--ink-muted)]">No field visits scheduled for today.</p>
            ) : null}
          </div>
        </div>

        <div className="dc-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Open Complaints</p>
            <Link href="/complaints" className="text-xs font-semibold text-[var(--accent)] hover:underline">All complaints</Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {openComplaints.map((complaint) => (
              <Link key={complaint.id} href="/complaints" className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--panel-strong)]/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{complaint.clientName}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">
                    <span className="mono">{complaint.complaintNumber}</span> · {complaint.category.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{complaint.status.replace(/_/g, " ").toLowerCase()}</p>
                  <p className="text-[0.6875rem] text-[var(--ink-muted)]">{complaint.createdAt.toLocaleDateString("en-UG", { day: "numeric", month: "short" })}</p>
                </div>
              </Link>
            ))}
            {openComplaints.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--ink-muted)]">No open complaints. All clear.</p>
            ) : null}
          </div>
        </div>
      </div>

    </div>
  );
}
