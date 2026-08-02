import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { RowActionsMenu, MenuSection, MenuActionLink, MenuActionButton } from "@/components/shared/RowActionsMenu";
import { DocumentPreviewButton } from "@/components/documents/DocumentPreviewButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { formatEATDate } from "@/lib/date-eat";
import { normalizeJobStatus } from "@/lib/job-status";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { ensureQuotationFromJob } from "@/lib/commercial/document-workflow";

function DeviceIcon({ type }: { type: string }) {
  const cls = "inline-block h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]";
  switch (type) {
    case "PHONE_ANDROID":
    case "PHONE_IPHONE":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
      );
    case "TABLET":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
      );
    case "WINDOWS_PC":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      );
    case "MAC":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55A1 1 0 0 1 20.38 20H3.62a1 1 0 0 1-.9-1.45L4 16"/>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      );
  }
}

type SearchParams = { q?: string; status?: string; period?: string; page?: string };

const PAGE_SIZE = 20;

export default async function JobCardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (!can.generateJobCards(user)) redirect("/dashboard");
  await requireModule(OrgModule.JOBS);

  const { q, status: statusFilter, period: periodFilter = "all", page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  async function convertJobCardToQuotationAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!(["ADMIN", "OPS", "MANAGER", "SALES", "FINANCE"].includes(user.role) || can.viewFinancials(user))) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const jobId = String(formData.get("jobId") ?? "").trim();
    if (!jobId) return;

    const quotation = await prisma.$transaction(async (tx) => {
      const quotation = await ensureQuotationFromJob(tx, { orgId, jobId, userId: user.id, currency: org.baseCurrency });
      return quotation ? { id: quotation.id, quoteNumber: quotation.quoteNumber } : null;
    });
    if (quotation) {
      await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "Quotation", entityId: quotation.id, action: "JOB_CARD_CONVERTED_TO_QUOTATION", summary: `Job card converted to quotation ${quotation.quoteNumber}` });
    }

    revalidatePath("/documents/job-cards");
    revalidatePath("/documents/quotations");
  }

  const where = {
    orgId,
    ...(statusFilter ? { status: statusFilter as never } : {}),
    ...(periodFilter === "this_month" ? { receivedAt: { gte: thisMonthStart } } : {}),
    ...(periodFilter === "last_month" ? { receivedAt: { gte: lastMonthStart, lte: lastMonthEnd } } : {}),
    ...(q
      ? {
          OR: [
            { jobNumber: { contains: q } },
            { client: { fullName: { contains: q } } },
            { brand: { contains: q } },
            { model: { contains: q } },
          ],
        }
      : {}),
  };

  const [jobs, total, statusCounts] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        jobNumber: true,
        status: true,
        brand: true,
        model: true,
        deviceType: true,
        issueDescription: true,
        receivedAt: true,
        client: { select: { fullName: true, phone: true } },
      },
    }),
    prisma.job.count({ where }),
    prisma.job.groupBy({ by: ["status"], _count: { status: true }, where }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((c) => [c.status, c._count.status]));

  // Preserve filters across pages.
  function pageHref(targetPage: number) {
    const params = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(periodFilter && periodFilter !== "all" ? { period: periodFilter } : {}),
      ...(targetPage > 1 ? { page: String(targetPage) } : {}),
    });
    const qs = params.toString();
    return qs ? `/documents/job-cards?${qs}` : "/documents/job-cards";
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const STATUS_OPTIONS = [
    "RECEIVED",
    "DIAGNOSING",
    "AWAITING_APPROVAL",
    "IN_REPAIR",
    "READY_FOR_PICKUP",
    "COMPLETED",
  ];

  return (
    <section className="space-y-4">

      {/* ── Mobile: tap any job → Job Card button at the bottom ── */}
      <div className="sm:hidden rounded-2xl border border-sky-500/20 bg-sky-500/6 px-4 py-3">
        <p className="text-[12px] font-semibold text-sky-500 mb-1">Print a job card</p>
        <p className="text-[13px] text-[var(--ink-muted)] leading-relaxed">
          Tap any job below → the <strong className="text-[var(--ink)]">Generate Job Card</strong> button appears at the bottom of the screen — prints or downloads instantly.
        </p>
      </div>

      {/* Action row */}
      <PageHeader
        title="Job Cards"
        eyebrow="Documents"
        description={`${total} job card${total === 1 ? "" : "s"}`}
        actions={
          <Link
            href="/jobs/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 text-[13px] font-bold text-black transition hover:brightness-105"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5"><path d="M12 5v14M5 12h14" /></svg>
            New Repair Job
          </Link>
        }
        kpis={[
          { label: "Showing", value: total, sub: "job cards" },
          { label: "In repair", value: byStatus.IN_REPAIR ?? 0, sub: "active repairs" },
          { label: "Ready pickup", value: byStatus.READY_FOR_PICKUP ?? 0, sub: "awaiting collection", valueClass: (byStatus.READY_FOR_PICKUP ?? 0) > 0 ? "text-[var(--dc-good)]" : undefined },
          { label: "Awaiting approval", value: byStatus.AWAITING_APPROVAL ?? 0, sub: "need decision", valueClass: (byStatus.AWAITING_APPROVAL ?? 0) > 0 ? "text-[var(--dc-warn)]" : undefined },
        ]}
      />

      {/* Period chips */}
      <div className="flex gap-2">
        {([
          { label: "All time", value: "all" },
          { label: "This month", value: "this_month" },
          { label: "Last month", value: "last_month" },
        ] as const).map(({ label, value }) => (
          <Link key={value}
            href={`/documents/job-cards?${new URLSearchParams({ ...(q ? { q } : {}), ...(statusFilter ? { status: statusFilter } : {}), period: value === "all" ? "" : value }).toString()}`}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${periodFilter === value ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"}`}>
            {label}
          </Link>
        ))}
      </div>

      {/* Search + filter */}
      <form method="GET" className="flex flex-wrap gap-2">
        <input type="hidden" name="period" value={periodFilter === "all" ? "" : periodFilter} />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search job #, client, device…"
          className="flex-1 min-w-[180px] rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] text-[var(--ink)] placeholder-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50"
        />
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/40"
        >
          Filter
        </button>
        {(q || statusFilter) && (
          <Link
            href="/documents/job-cards"
            className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-2 text-sm text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <DataTable
        rows={jobs}
        getRowKey={(job) => job.id}
        empty={q || statusFilter ? "No jobs match your filter." : "No jobs yet. Create a job first."}
        pagination={{ page, pageSize: PAGE_SIZE, total, hrefForPage: pageHref, unit: "job cards" }}
        columns={[
          {
            key: "job",
            header: "Job",
            cell: (job) => (
              <>
                <Link href={`/jobs/${job.id}`} className="mono font-semibold text-[var(--accent)] hover:underline">
                  {job.jobNumber}
                </Link>
                <p className="mt-0.5 text-[12px] text-[var(--ink-muted)] sm:hidden">{job.client.fullName}</p>
              </>
            ),
          },
          {
            key: "client",
            header: "Client",
            headerClassName: "hidden sm:table-cell",
            className: "hidden sm:table-cell",
            cell: (job) => (
              <>
                <p className="font-medium text-[var(--ink)]">{job.client.fullName}</p>
                <p className="text-[12px] text-[var(--ink-muted)]">{job.client.phone}</p>
              </>
            ),
          },
          {
            key: "device",
            header: "Device",
            headerClassName: "hidden md:table-cell",
            className: "hidden md:table-cell",
            cell: (job) => (
              <span className="inline-flex items-center gap-1.5">
                <DeviceIcon type={job.deviceType} />
                <span className="text-[var(--ink)]">{job.brand} {job.model}</span>
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (job) => <JobStatusBadge status={normalizeJobStatus(job.status as never)} />,
          },
          {
            key: "received",
            header: "Received",
            headerClassName: "hidden lg:table-cell",
            className: "hidden whitespace-nowrap text-[var(--ink-muted)] lg:table-cell",
            cell: (job) => formatEATDate(job.receivedAt),
          },
        ]}
        actions={(job) => {
          const jobUrl = `${appUrl}/jobs/${job.id}`;
          const pdfHref = `/api/jobs/${job.id}/job-card`;
          const clientPhone = job.client.phone.replace(/\D/g, "");
          const waPhone = clientPhone.startsWith("0") ? "256" + clientPhone.slice(1) : clientPhone;
          const waText = encodeURIComponent(
            `Hi ${job.client.fullName}, your device (${job.brand} ${job.model}) has been received at our workshop.\n\nJob #: ${job.jobNumber}\nIssue noted: ${job.issueDescription.slice(0, 80)}${job.issueDescription.length > 80 ? "…" : ""}\n\nWe'll update you as soon as diagnosis is complete.`,
          );
          return (
            <>
              <a
                href={pdfHref}
                target="_blank"
                rel="noreferrer"
                title="Open job card PDF"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              </a>
              <RowActionsMenu label="Job card actions">
                <MenuSection label="Actions" />
                <DocumentPreviewButton pdfUrl={`/api/jobs/${job.id}/job-card`} title={`Job card ${job.jobNumber}`} />
                <MenuActionLink href={`/api/jobs/${job.id}/job-card`} external icon="job" tone="accent">
                  Download Job Card PDF
                </MenuActionLink>
                <form action={convertJobCardToQuotationAction} className="px-3 py-1.5">
                  <input type="hidden" name="jobId" value={job.id} />
                  <MenuActionButton icon="quote" tone="accent">
                    Convert to Quotation
                  </MenuActionButton>
                </form>
                <MenuActionLink href={`https://wa.me/${waPhone}?text=${waText}`} external icon="whatsapp" tone="success">
                  Send via WhatsApp
                </MenuActionLink>
                <div className="px-3 py-1.5">
                  <CopyButton
                    text={jobUrl}
                    label="Copy job link"
                    title="Copy job page link"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
                  />
                </div>
              </RowActionsMenu>
            </>
          );
        }}
      />
    </section>
  );
}
