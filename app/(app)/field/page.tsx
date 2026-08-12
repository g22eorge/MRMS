import Link from "next/link";
import { redirect } from "next/navigation";
import { FieldVisitStatus } from "@prisma/client";
import { getCurrentUserRole } from "@/lib/session";

import { can } from "@/lib/permissions";
import { orgDb } from "@/lib/db";
import { formatEATDateTime } from "@/lib/date-eat";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { ServiceHubNav } from "@/components/service/ServiceHubNav";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<FieldVisitStatus, string> = {
  SCHEDULED:  "Scheduled",
  EN_ROUTE:   "En Route",
  ARRIVED:    "Arrived",
  COMPLETED:  "Completed",
  FAILED:     "Failed",
  CANCELLED:  "Cancelled",
};

const STATUS_TONES: Record<FieldVisitStatus, BadgeTone> = {
  SCHEDULED: "info",
  EN_ROUTE:  "warning",
  ARRIVED:   "orange",
  COMPLETED: "success",
  FAILED:    "danger",
  CANCELLED: "neutral",
};

const TYPE_LABELS: Record<string, string> = {
  COLLECTION:   "Collection",
  DELIVERY:     "Delivery",
  ONSITE_REPAIR:"Onsite Repair",
  ASSESSMENT:   "Assessment",
  FOLLOWUP:     "Follow-up",
};

const TYPE_TONES: Record<string, BadgeTone> = {
  COLLECTION:    "purple",
  DELIVERY:      "teal",
  ONSITE_REPAIR: "danger",
  ASSESSMENT:    "violet",
  FOLLOWUP:      "neutral",
};

const TAB_OPTIONS = [
  { key: "upcoming",   label: "Upcoming"  },
  { key: "COMPLETED",  label: "Completed" },
  { key: "FAILED",     label: "Failed"    },
  { key: "CANCELLED",  label: "Cancelled" },
  { key: "ALL",        label: "All"       },
] as const;

export default async function FieldPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { user } = await getCurrentUserRole();
  const db = orgDb(user.orgId);

  const isManager    = can.manageFieldVisits(user);
  const isFieldTech  = can.recordFieldSignoffs(user);

  if (!isManager && !isFieldTech) redirect("/");

  const { status: statusParam, q: qParam, page: pageParam } = await searchParams;
  const activeTab = statusParam ?? "upcoming";
  const q = qParam?.trim() ?? "";
  const page = parsePage(pageParam);

  const now           = new Date();
  const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd      = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const kpiBaseWhere = !isManager ? { assignedToId: user.id } : {};

  // ── KPI counts + staff-breakdown source data in parallel ─────────────────
  const [
    kpiTotal,
    kpiPending,
    kpiCompletedMonth,
    kpiFailedMonth,
    kpiToday,
    monthVisits,       // used for staff breakdown + type breakdown
  ] = await Promise.all([
    db.fieldVisit.count({ where: kpiBaseWhere }).catch(() => 0),
    db.fieldVisit.count({ where: { ...kpiBaseWhere, status: { in: ["SCHEDULED", "EN_ROUTE", "ARRIVED"] } } }).catch(() => 0),
    db.fieldVisit.count({ where: { ...kpiBaseWhere, status: "COMPLETED", scheduledAt: { gte: monthStart } } }).catch(() => 0),
    db.fieldVisit.count({ where: { ...kpiBaseWhere, status: "FAILED",    scheduledAt: { gte: monthStart } } }).catch(() => 0),
    db.fieldVisit.count({ where: { ...kpiBaseWhere, scheduledAt: { gte: todayStart, lte: todayEnd } } }).catch(() => 0),
    isManager
      ? db.fieldVisit.findMany({
          where: { scheduledAt: { gte: monthStart } },
          select: {
            status: true,
            type:   true,
            assignedTo: { select: { id: true, name: true, role: true } },
          },
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  // ── Staff breakdown (manager view only) ──────────────────────────────────
  type StaffRow = {
    id: string;
    name: string;
    role: string;
    total: number;
    pending: number;
    completed: number;
    failed: number;
    rate: number; // completion rate %
  };

  const staffMap = new Map<string, StaffRow>();
  if (isManager) {
    for (const v of monthVisits) {
      const tech = v.assignedTo;
      if (!tech) continue;
      if (!staffMap.has(tech.id)) {
        staffMap.set(tech.id, { id: tech.id, name: tech.name, role: tech.role, total: 0, pending: 0, completed: 0, failed: 0, rate: 0 });
      }
      const row = staffMap.get(tech.id)!;
      row.total++;
      if (["SCHEDULED", "EN_ROUTE", "ARRIVED"].includes(v.status)) row.pending++;
      if (v.status === "COMPLETED") row.completed++;
      if (v.status === "FAILED")    row.failed++;
    }
    for (const row of staffMap.values()) {
      const terminal = row.completed + row.failed;
      row.rate = terminal > 0 ? Math.round((row.completed / terminal) * 100) : 0;
    }
  }
  const staffRows = [...staffMap.values()].sort((a, b) => b.total - a.total);

  // ── Visit type breakdown (this month) ────────────────────────────────────
  const typeCount: Record<string, number> = {};
  for (const v of monthVisits) {
    typeCount[v.type] = (typeCount[v.type] ?? 0) + 1;
  }
  const typeBreakdown = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count, label: TYPE_LABELS[type] ?? type, tone: toneFor(TYPE_TONES, type) }));

  // ── Completion rate for KPI sub-label ────────────────────────────────────
  const terminalMonth = kpiCompletedMonth + kpiFailedMonth;
  const completionRate = terminalMonth > 0 ? Math.round((kpiCompletedMonth / terminalMonth) * 100) : null;

  // ── Tab-filtered visit list ───────────────────────────────────────────────
  let statusFilter: FieldVisitStatus[] | undefined;
  if      (activeTab === "upcoming") statusFilter = ["SCHEDULED", "EN_ROUTE", "ARRIVED"];
  else if (activeTab === "ALL")      statusFilter = undefined;
  else if (Object.keys(STATUS_LABELS).includes(activeTab)) statusFilter = [activeTab as FieldVisitStatus];
  else    statusFilter = ["SCHEDULED", "EN_ROUTE", "ARRIVED"];

  const visitsWhere = {
    ...(statusFilter ? { status: { in: statusFilter } } : {}),
    ...(!isManager ? { assignedToId: user.id } : {}),
    ...(q ? {
      OR: [
        { visitNumber: { contains: q } },
        { job: { jobNumber: { contains: q } } },
        { job: { client: { fullName: { contains: q } } } },
        { assignedTo: { name: { contains: q } } },
      ],
    } : {}),
  };

  const [visitsTotal, visits] = await Promise.all([
    db.fieldVisit.count({ where: visitsWhere }).catch(() => 0),
    db.fieldVisit.findMany({
      where: visitsWhere,
      include: {
        assignedTo:  { select: { id: true, name: true } },
        scheduledBy: { select: { id: true, name: true } },
        job:         { select: { id: true, jobNumber: true, brand: true, model: true } },
      },
      orderBy: { scheduledAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }).catch(() => []),
  ]);

  const pageView = paginationView(page, visitsTotal);
  const visitsHref = pageHrefBuilder("/field", { status: statusParam ?? "", q });

  return (
    <ListPageLayout
      topBar={<ServiceHubNav />}
      header={{
        eyebrow: "Service",
        title: "Field Visits",
        description: isManager ? "All scheduled field visits" : "Your assigned field visits",
        kpis: [
          { label: "Today's Visits", value: kpiToday, sub: "scheduled today" },
          { label: "Pending", value: kpiPending, sub: "scheduled · en route · arrived" },
          { label: "Completed This Month", value: kpiCompletedMonth, sub: completionRate !== null ? `${completionRate}% success rate` : "this month", tone: "good" },
          { label: "Failed This Month", value: kpiFailedMonth, sub: terminalMonth > 0 ? `${100 - (completionRate ?? 100)}% failure rate` : "this month", tone: kpiFailedMonth > 0 ? "crit" : "neutral" },
          { label: "Total Visits", value: kpiTotal, sub: "all time" },
        ],
        actions: isManager ? (
          <Link
            href="/field/new"
            className="btn-premium inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.75rem]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Schedule Visit
          </Link>
        ) : undefined,
      }}
    >
      <div className="space-y-4">

      {/* ── Visit Type Breakdown + Staff Breakdown (manager only) ── */}
      {isManager && (
        <div className="grid gap-4 lg:grid-cols-3">

          {/* Visit type breakdown */}
          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Visit Types — This Month</p>
            {typeBreakdown.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-muted)]">No visits this month.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {typeBreakdown.map(({ type, count, label, tone }) => {
                  const pct = monthVisits.length > 0 ? Math.round((count / monthVisits.length) * 100) : 0;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-0.5">
                        <StatusBadge tone={tone}>{label}</StatusBadge>
                        <span className="text-xs font-semibold tabular-nums text-[var(--ink)]">{count} <span className="text-[var(--ink-muted)] font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)]">
                        <div className="h-full rounded-full bg-[var(--accent)]/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Staff breakdown */}
          <div className="lg:col-span-2 panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="border-b border-[var(--line)] bg-[var(--panel-strong)]/50 px-4 py-2.5">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Staff Performance — This Month</p>
            </div>
            <DataTable
              frameless
              rows={staffRows}
              getRowKey={(row) => row.id}
              empty="No visits assigned this month."
              renderMobileCard={(row) => (
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--ink)]">{row.name}</p>
                      <p className="text-[0.8125rem] text-[var(--ink-muted)] capitalize">{row.role.replace(/_/g, " ").toLowerCase()}</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${row.rate >= 80 ? "text-emerald-700" : row.rate >= 60 ? "text-amber-700" : row.completed + row.failed > 0 ? "text-red-600" : "text-[var(--ink-muted)]"}`}>
                      {row.completed + row.failed > 0 ? `${row.rate}%` : "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.8125rem] text-[var(--ink-muted)]">
                    <span>Total: <strong className="text-[var(--ink)]">{row.total}</strong></span>
                    <span>Pending: {row.pending}</span>
                    <span className="text-emerald-700">Done: <strong>{row.completed}</strong></span>
                    {row.failed > 0 && <span className="text-red-600">Failed: <strong>{row.failed}</strong></span>}
                  </div>
                </div>
              )}
              columns={[
                {
                  key: "staff",
                  header: "Staff Member",
                  cell: (row) => (
                    <>
                      <p className="font-medium text-[var(--ink)]">{row.name}</p>
                      <p className="text-[var(--ink-muted)] capitalize">{row.role.replace(/_/g, " ").toLowerCase()}</p>
                    </>
                  ),
                },
                { key: "total", header: "Total", align: "right", className: "font-semibold tabular-nums whitespace-nowrap text-[var(--ink)]", cell: (row) => row.total },
                { key: "pending", header: "Pending", align: "right", className: "tabular-nums whitespace-nowrap text-[var(--ink-muted)]", cell: (row) => row.pending },
                { key: "completed", header: "Completed", align: "right", className: "tabular-nums whitespace-nowrap text-emerald-700 font-semibold", cell: (row) => row.completed },
                {
                  key: "failed",
                  header: "Failed",
                  align: "right",
                  className: "tabular-nums whitespace-nowrap",
                  cell: (row) => <span className={row.failed > 0 ? "font-semibold text-red-600" : "text-[var(--ink-muted)]"}>{row.failed}</span>,
                },
                {
                  key: "rate",
                  header: "Success Rate",
                  align: "right",
                  cell: (row) => (
                    <span className={`font-bold tabular-nums ${row.rate >= 80 ?"text-emerald-700" : row.rate >= 60 ? "text-amber-700" : "text-red-600"}`}>
                      {row.completed + row.failed > 0 ? `${row.rate}%` : "—"}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* ── Search + tab bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <form method="GET" className="flex gap-2 flex-1 min-w-[200px]">
          {statusParam && <input type="hidden" name="status" value={statusParam} />}
          <input name="q" defaultValue={q} placeholder="Search visit #, job, client, technician…"
            className="h-8 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-[0.75rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50" />
          <button type="submit" className="h-8 rounded-lg border border-[var(--line)] px-3 text-[0.75rem] font-medium hover:bg-[var(--panel-strong)]">Search</button>
          {q && <a href={`/field${statusParam ? `?status=${statusParam}` : ""}`} className="flex h-8 items-center rounded-lg border border-[var(--line)] px-3 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">Clear</a>}
        </form>
      </div>

      <div className="flex gap-1 border-b border-[var(--line)]">
        {TAB_OPTIONS.map((tab) => (
          <Link
            key={tab.key}
            href={`/field?status=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-[var(--accent)] text-[var(--ink)]"
                : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* ── Visit list ── */}
      <DataTable
        className="panel-shadow"
        rows={visits}
        getRowKey={(visit) => visit.id}
        empty="No field visits found for this filter."
        renderMobileCard={(visit) => (
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={toneFor(TYPE_TONES, visit.type)}>{TYPE_LABELS[visit.type] ?? visit.type}</StatusBadge>
                <StatusBadge tone={toneFor(STATUS_TONES, visit.status)}>{STATUS_LABELS[visit.status]}</StatusBadge>
              </div>
              <Link href={`/field/${visit.id}`} className="shrink-0 text-xs font-semibold text-[var(--accent)] hover:underline">View →</Link>
            </div>
            <p className="mt-1 text-[0.75rem] text-[var(--ink)]">{formatEATDateTime(visit.scheduledAt)}</p>
            <p className="mt-0.5 line-clamp-1 text-[var(--ink-muted)]">{visit.address}</p>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[var(--ink-muted)]">
              {visit.contactName && <span>Contact: {visit.contactName}{visit.contactPhone ? ` (${visit.contactPhone})` : ""}</span>}
              {isManager && <span>Assigned: <span className="text-[var(--ink)]">{visit.assignedTo.name}</span></span>}
              {visit.job && (
                <span>Job: <Link href={`/jobs/${visit.job.id}`} className="mono font-semibold text-[var(--accent)] hover:underline">{visit.job.jobNumber}</Link></span>
              )}
            </div>
          </div>
        )}
        columns={[
          {
            key: "scheduledAt",
            header: "Date / Time",
            className: "whitespace-nowrap text-[var(--ink)]",
            cell: (visit) => formatEATDateTime(visit.scheduledAt),
          },
          {
            key: "type",
            header: "Type",
            className: "whitespace-nowrap",
            cell: (visit) => <StatusBadge tone={toneFor(TYPE_TONES, visit.type)}>{TYPE_LABELS[visit.type] ?? visit.type}</StatusBadge>,
          },
          {
            key: "address",
            header: "Address",
            className: "max-w-[180px] truncate text-[var(--ink)]",
            cell: (visit) => visit.address,
          },
          ...(isManager
            ? [
                {
                  key: "assignedTo",
                  header: "Assigned To",
                  className: "whitespace-nowrap text-[var(--ink)]",
                  cell: (visit: (typeof visits)[number]) => visit.assignedTo.name,
                },
              ]
            : []),
          {
            key: "contact",
            header: "Contact",
            className: "whitespace-nowrap text-[0.75rem] text-[var(--ink-muted)]",
            cell: (visit) => (
              <>
                {visit.contactName ?? "—"}
                {visit.contactPhone && (
                  <span className="ml-1 text-[var(--ink-muted)]/60">({visit.contactPhone})</span>
                )}
              </>
            ),
          },
          {
            key: "job",
            header: "Job",
            className: "whitespace-nowrap",
            cell: (visit) =>
              visit.job ? (
                <Link href={`/jobs/${visit.job.id}`} className="mono font-semibold text-[var(--accent)] hover:underline">
                  {visit.job.jobNumber}
                </Link>
              ) : (
                <span className="text-[var(--ink-muted)]">—</span>
              ),
          },
          {
            key: "status",
            header: "Status",
            className: "whitespace-nowrap",
            cell: (visit) => <StatusBadge tone={toneFor(STATUS_TONES, visit.status)}>{STATUS_LABELS[visit.status]}</StatusBadge>,
          },
        ]}
        actions={(visit) => (
          <Link href={`/field/${visit.id}`} className="font-semibold text-[var(--accent)] hover:underline whitespace-nowrap">
            View →
          </Link>
        )}
      />

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="visits"
        hrefForPage={visitsHref}
      />
      </div>
    </ListPageLayout>
  );
}
