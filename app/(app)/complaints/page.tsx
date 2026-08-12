import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import type { ComplaintStatus } from "@prisma/client";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUSES,
  SLA_HOURS,
} from "@/lib/complaints";
import { RowActionsMenu, MenuSection } from "@/components/shared/RowActionsMenu";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { ServiceHubNav } from "@/components/service/ServiceHubNav";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const STATUSES = COMPLAINT_STATUSES as unknown as ComplaintStatus[];
const ALLOWED_ROLES = ["ADMIN", "MANAGER", "TECH_MANAGER", "OPS"] as const;

const STATUS_TONES: Record<string, BadgeTone> = {
  RECEIVED: "warning",
  ACKNOWLEDGED: "sky",
  INVESTIGATING: "violet",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireModule(OrgModule.COMPLAINTS);
  const { user, orgId } = await requireOrgSession();
  if (!(ALLOWED_ROLES as readonly string[]).includes(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const page = parsePage(params.page);
  const filterStatus = STATUSES.includes(params.status as ComplaintStatus)
    ? (params.status as ComplaintStatus)
    : null;

  async function updateStatusAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(ALLOWED_ROLES as readonly string[]).includes(user.role)) return;

    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "") as ComplaintStatus;
    const resolution = String(formData.get("resolution") ?? "").trim();
    const internalNotes = String(formData.get("internalNotes") ?? "").trim();

    if (!id || !STATUSES.includes(status)) return;

    const now = new Date();
    await prisma.complaint.updateMany({
      where: { id, orgId },
      data: {
        status,
        ...(resolution ? { resolution } : {}),
        ...(internalNotes ? { internalNotes } : {}),
        ...(status === "ACKNOWLEDGED" ? { acknowledgedAt: now } : {}),
        ...(status === "INVESTIGATING" ? { investigatingAt: now } : {}),
        ...(status === "RESOLVED" ? { resolvedAt: now } : {}),
        ...(status === "CLOSED" ? { closedAt: now } : {}),
      },
    });
    revalidatePath("/complaints");
  }

  const qSearch = params.q?.trim() ?? "";
  const complaintsWhere = {
    orgId,
    ...(filterStatus ? { status: filterStatus } : {}),
    ...(qSearch ? {
      OR: [
        { clientName: { contains: qSearch } },
        { description: { contains: qSearch } },
        { complaintNumber: { contains: qSearch } },
      ],
    } : {}),
  };
  const [complaintsTotal, complaints, counts] = await Promise.all([
    prisma.complaint.count({ where: complaintsWhere }).catch(() => 0),
    prisma.complaint.findMany({
      where: complaintsWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        complaintNumber: true,
        status: true,
        category: true,
        channel: true,
        clientName: true,
        clientPhone: true,
        description: true,
        resolution: true,
        internalNotes: true,
        acknowledgedAt: true,
        resolvedAt: true,
        closedAt: true,
        createdAt: true,
        job: { select: { id: true, jobNumber: true } },
      },
    }).catch(() => [] as never[]),
    prisma.complaint.groupBy({
      by: ["status"],
      _count: { status: true },
      where: { orgId },
    }).catch(() => [] as Array<{ status: ComplaintStatus; _count: { status: number } }>),
  ]);

  const pageView = paginationView(page, complaintsTotal);
  const complaintsHref = pageHrefBuilder("/complaints", { status: filterStatus ?? "", q: qSearch });

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count?.status ?? 0]));
  const now = new Date();

  function slaStatus(complaint: (typeof complaints)[0]) {
    const ageHours = (now.getTime() - new Date(complaint.createdAt).getTime()) / 3600000;
    if (!complaint.acknowledgedAt && ageHours > SLA_HOURS.acknowledgement) return "overdue-ack";
    if (
      !complaint.resolvedAt &&
      ageHours > SLA_HOURS.resolution &&
      complaint.status !== "RESOLVED" &&
      complaint.status !== "CLOSED"
    )
      return "overdue-res";
    return "ok";
  }

  const totalOpen = counts
    .filter((c) => c.status !== "CLOSED" && c.status !== "RESOLVED")
    .reduce((sum, c) => sum + (c._count?.status ?? 0), 0);

  const updateMenu = (c: (typeof complaints)[0]) => (
    <RowActionsMenu label="Update complaint">
      <MenuSection label="Update Status" />
      <form action={updateStatusAction} className="space-y-2 p-3">
        <input type="hidden" name="id" value={c.id} />
        <select name="status" defaultValue={c.status} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none">
          {STATUSES.map((s) => <option key={s} value={s}>{COMPLAINT_STATUS_LABELS[s]}</option>)}
        </select>
        <textarea name="resolution" defaultValue={c.resolution ?? ""} placeholder="Resolution (shown to client)" rows={2} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none resize-none" />
        <textarea name="internalNotes" defaultValue={c.internalNotes ?? ""} placeholder="Internal notes" rows={2} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none resize-none" />
        <button type="submit" className="btn-premium w-full rounded-lg px-3 py-1.5 text-xs">Save</button>
      </form>
    </RowActionsMenu>
  );

  return (
    <ListPageLayout
      topBar={<ServiceHubNav />}
      header={{
        eyebrow: "Service",
        title: "Complaints",
        actions: (
          <>
            {totalOpen > 0 ? <StatusBadge tone="warning">{totalOpen} open</StatusBadge> : null}
            <a
              href="/feedback"
              target="_blank"
              rel="noreferrer"
              className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs"
            >
              Client Portal ↗
            </a>
          </>
        ),
        kpis: [
          { label: "Total", value: complaintsTotal, sub: "all matching" },
          { label: "Open", value: totalOpen, sub: "active cases", valueClass: totalOpen > 0 ? "text-amber-600" : undefined },
          { label: "Resolved", value: (byStatus["RESOLVED"] ?? 0) + (byStatus["CLOSED"] ?? 0), sub: "resolved + closed", valueClass: "text-emerald-600" },
          { label: "Acknowledged", value: byStatus["ACKNOWLEDGED"] ?? 0, sub: "in progress" },
        ],
      }}
      filters={
        <div className="dc-card flex flex-wrap items-center gap-2 px-4 py-3">
          {[
            { label: "All", key: "" },
            ...STATUSES.map((s) => ({ label: COMPLAINT_STATUS_LABELS[s], key: s })),
          ].map(({ label, key }) => {
            const active = (filterStatus ?? "") === key;
            return (
              <Link
                key={key || "all"}
                href={key ? `/complaints?status=${key}` : "/complaints"}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                    : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/30"
                }`}
              >
                {label}
                {key ? ` · ${byStatus[key] ?? 0}` : ""}
              </Link>
            );
          })}
          <form method="GET" className="ml-auto flex gap-1.5">
            {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
            <input name="q" defaultValue={params.q ?? ""} placeholder="Search client, description…"
              className="h-7 min-w-[160px] rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-[0.75rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50" />
            <button type="submit" className="h-7 rounded-full border border-[var(--line)] px-3 text-[0.75rem] font-medium hover:bg-[var(--panel-strong)]">Search</button>
          </form>
        </div>
      }
    >
      <DataTable
        rows={complaints}
        getRowKey={(c) => c.id}
        empty="No complaints yet."
        className="panel-shadow"
        renderMobileCard={(c) => {
          const sla = slaStatus(c);
          return (
            <div className="px-4 py-3">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div>
                  <p className="mono text-[0.75rem] font-bold text-[var(--ink)]">{c.complaintNumber}</p>
                  <p className="text-[0.75rem] text-[var(--ink-muted)]">{new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <StatusBadge tone={toneFor(STATUS_TONES, c.status)} className="shrink-0">
                  {COMPLAINT_STATUS_LABELS[c.status]}
                </StatusBadge>
              </div>
              <p className="mb-1 font-semibold text-[var(--ink)]">{c.clientName}
                <span className="ml-1.5 font-normal text-[var(--ink-muted)]">{c.clientPhone}</span>
              </p>
              <p className="mb-1.5 line-clamp-2 text-[0.75rem] text-[var(--ink-muted)]">{c.description}</p>
              <div className="flex items-center gap-2 text-[0.8125rem] text-[var(--ink-muted)]">
                <span>{COMPLAINT_CATEGORY_LABELS[c.category]}</span>
                {(sla === "overdue-ack" || sla === "overdue-res") && (
                  <span className={`font-semibold ${sla === "overdue-ack" ? "text-red-600" : "text-amber-600"}`}>
                    {sla === "overdue-ack" ? "Ack overdue" : "Resolution overdue"}
                  </span>
                )}
                {c.job && (
                  <Link href={`/jobs/${c.job.id}`} className="mono font-semibold text-[var(--accent)] hover:underline">{c.job.jobNumber}</Link>
                )}
              </div>
              <div className="mt-2">{updateMenu(c)}</div>
            </div>
          );
        }}
        columns={[
          {
            key: "ref",
            header: "Ref",
            cell: (c) => (
              <>
                <p className="mono font-bold text-[var(--ink)]">{c.complaintNumber}</p>
                <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">{new Date(c.createdAt).toLocaleDateString()}</p>
              </>
            ),
          },
          {
            key: "status",
            header: "Status / SLA",
            cell: (c) => {
              const sla = slaStatus(c);
              return (
                <>
                  <StatusBadge tone={toneFor(STATUS_TONES, c.status)}>{COMPLAINT_STATUS_LABELS[c.status]}</StatusBadge>
                  {sla === "overdue-ack" && <p className="mt-1 text-[0.75rem] font-semibold text-red-600">Ack overdue</p>}
                  {sla === "overdue-res" && <p className="mt-1 text-[0.75rem] font-semibold text-amber-600">Resolution overdue</p>}
                </>
              );
            },
          },
          {
            key: "category",
            header: "Category",
            cell: (c) => (
              <>
                <p className="text-[var(--ink)]">{COMPLAINT_CATEGORY_LABELS[c.category]}</p>
                <p className="text-[0.75rem] text-[var(--ink-muted)]">{c.channel}</p>
              </>
            ),
          },
          {
            key: "client",
            header: "Client",
            cell: (c) => (
              <>
                <p className="font-semibold text-[var(--ink)]">{c.clientName}</p>
                <p className="text-[0.75rem] text-[var(--ink-muted)]">{c.clientPhone}</p>
              </>
            ),
          },
          {
            key: "description",
            header: "Description",
            className: "max-w-[200px]",
            cell: (c) => (
              <p className="line-clamp-3 text-[var(--ink-muted)]" title={c.description}>{c.description}</p>
            ),
          },
          {
            key: "job",
            header: "Job",
            cell: (c) =>
              c.job
                ? <Link href={`/jobs/${c.job.id}`} className="mono font-semibold text-[var(--accent)] hover:underline">{c.job.jobNumber}</Link>
                : <span className="text-[var(--ink-muted)]">—</span>,
          },
        ]}
        actions={(c) => updateMenu(c)}
      />

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="complaints"
        hrefForPage={complaintsHref}
      />
    </ListPageLayout>
  );
}
