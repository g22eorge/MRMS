import Link from "next/link";
import { redirect } from "next/navigation";

import { formatMoney, getAppCurrency } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import { getJobPayoutsByIds, getTechnicianPayoutTotalsByJobIds, hasJobPayoutColumns } from "@/lib/payouts";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { icontains } from "@/lib/db/search";

type SearchParams = {
  q?: string;
  paid?: string;
  month?: string;
};

const statusOptionLabel = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  REFERRED: "Referred",
  AWAITING_APPROVAL: "Awaiting Approval",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CLOSED: "Closed",
} as const;

function parseMonth(monthParam?: string) {
  if (!monthParam) return null;
  const [yearRaw, monthRaw] = monthParam.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export default async function TechnicianPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { session, user, orgId } = await requireOrgSession();
  if (user.role !== "TECHNICIAN_EXTERNAL") {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const month = parseMonth(filters.month);

  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      assignedToId: session.user.id,
      repairPath: "EXTERNAL",
      ...(filters.q
        ? {
            OR: [
              { jobNumber: icontains(filters.q) },
              { brand: icontains(filters.q) },
              { model: icontains(filters.q) },
            ],
          }
        : {}),
      ...(filters.paid === "paid" ? { externalPaid: true } : {}),
      ...(filters.paid === "unpaid" ? { externalPaid: false } : {}),
      ...(month ? { completedAt: { gte: month.start, lte: month.end } } : {}),
    },
    select: {
      id: true,
      jobNumber: true,
      status: true,
      brand: true,
      model: true,
      completedAt: true,
      receivedAt: true,
      externalTechBill: true,
    },
    orderBy: { receivedAt: "desc" },
  });

  const payoutColumnsReady = await hasJobPayoutColumns();
  const payouts = await getJobPayoutsByIds(jobs.map((job) => job.id));
  const payoutTotals = await getTechnicianPayoutTotalsByJobIds(jobs.map((job) => job.id));

  const currency = getAppCurrency();

  function resolveJobFee(job: typeof jobs[number]) {
    const fee = payouts.get(job.id)?.externalTechFee;
    if (typeof fee === "number" && fee > 0) return fee;
    if (typeof job.externalTechBill === "number" && job.externalTechBill > 0) return job.externalTechBill;
    return 0;
  }

  function paidForJob(jobId: string) {
    return payoutTotals.get(jobId)?.paidAmount ?? 0;
  }

  function balanceForJob(job: typeof jobs[number]) {
    return Math.max(0, resolveJobFee(job) - paidForJob(job.id));
  }

  const total = jobs.reduce((sum, job) => sum + resolveJobFee(job), 0);
  const paid = jobs.reduce((sum, job) => sum + Math.min(resolveJobFee(job), paidForJob(job.id)), 0);
  const unpaid = jobs.reduce((sum, job) => sum + balanceForJob(job), 0);
  const controlClass =
    "rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20";

  // Per-row payout status — computed once, reused in the table and mobile card.
  type PayoutRow = (typeof jobs)[number];
  function payoutStatus(job: PayoutRow) {
    const payout = payouts.get(job.id);
    const feeAmount = resolveJobFee(job);
    const paidAmount = paidForJob(job.id);
    const balance = Math.max(0, feeAmount - paidAmount);
    const isPaid = (payout?.externalPaid ?? false) || (feeAmount > 0 && balance <= 0);
    const isPartPaid = !isPaid && paidAmount > 0;
    return {
      payout, feeAmount, paidAmount, balance, isPaid, isPartPaid,
      label: isPaid ? "Paid" : isPartPaid ? "Partially paid" : "Unpaid",
      tone: (isPaid ? "success" : isPartPaid ? "info" : "warning") as "success" | "info" | "warning",
      device: [job.brand, job.model].filter((v) => v && v !== "Unknown").join(" ") || "Device",
    };
  }

  return (
    <ListPageLayout
      header={{
        eyebrow: "Service",
        title: "My Payouts",
        kpis: [
          { label: "Total in view", value: formatMoney(total, currency), sub: `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}` },
          { label: "Paid", value: formatMoney(paid, currency), sub: "settled", valueClass: paid > 0 ? "text-emerald-600" : undefined },
          { label: "Outstanding", value: formatMoney(unpaid, currency), sub: "still owed", valueClass: unpaid > 0 ? "text-amber-600" : undefined },
        ],
        actions: (
          <Link href="/dashboard" className="inline-flex items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
            ← Dashboard
          </Link>
        ),
      }}
      filters={
        <>
          {!payoutColumnsReady ? (
            <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
              Payout columns are not migrated yet in this environment. Run latest Prisma migrations.
            </div>
          ) : null}
          <form className="dc-card grid gap-2 p-3 lg:grid-cols-4">
            <input name="q" defaultValue={filters.q} placeholder="Search job # / device" className={controlClass} />
            <select name="paid" defaultValue={filters.paid} className={controlClass}>
              <option value="">All statuses</option>
              <option value="paid">Paid only</option>
              <option value="unpaid">Unpaid only</option>
            </select>
            <input type="month" name="month" defaultValue={filters.month} className={controlClass} />
            <div className="flex gap-2">
              <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-2">Apply</button>
              <Link href="/technicians/payouts" className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">Reset</Link>
            </div>
          </form>
        </>
      }
    >
      <DataTable
        rows={jobs}
        getRowKey={(job) => job.id}
        empty="No payout records found for these filters."
        rowClassName={(job) => {
          const s = payoutStatus(job);
          return s.isPaid ? undefined : s.isPartPaid ? "bg-blue-500/5" : "bg-amber-500/5";
        }}
        columns={[
          {
            key: "job",
            header: "Job",
            className: "mono font-semibold",
            cell: (job) => (
              <Link href={`/jobs/${job.id}?returnTo=/technicians/payouts&returnLabel=Payouts`} className="text-[var(--ink)] hover:text-[var(--accent)]">
                {job.jobNumber}
              </Link>
            ),
          },
          {
            key: "device",
            header: "Device",
            className: "text-[var(--ink)]",
            cell: (job) => payoutStatus(job).device,
          },
          {
            key: "stage",
            header: "Stage",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[var(--ink-muted)] md:table-cell",
            cell: (job) => (
              <>
                {(statusOptionLabel as Record<string, string>)[job.status] ?? job.status}
                {job.completedAt ? ` · ${formatEATDate(job.completedAt)}` : ""}
              </>
            ),
          },
          {
            key: "status",
            header: "Payout",
            cell: (job) => {
              const s = payoutStatus(job);
              return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
            },
          },
          {
            key: "amount",
            header: "Paid / Fee",
            align: "right",
            className: "tabular-nums whitespace-nowrap font-semibold text-[var(--ink)]",
            cell: (job) => {
              const s = payoutStatus(job);
              return `${formatMoney(s.paidAmount, currency)} / ${formatMoney(s.feeAmount, currency)}`;
            },
          },
        ]}
        renderMobileCard={(job) => {
          const s = payoutStatus(job);
          return (
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/jobs/${job.id}?returnTo=/technicians/payouts&returnLabel=Payouts`} className="mono text-[0.75rem] font-medium tracking-wide text-[var(--ink-muted)]">{job.jobNumber}</Link>
                  <p className="truncate text-[0.9375rem] font-bold leading-snug tracking-tight text-[var(--ink)]">{s.device}</p>
                  <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">
                    {(statusOptionLabel as Record<string, string>)[job.status] ?? job.status}
                    {job.completedAt ? ` · ${formatEATDate(job.completedAt)}` : ""}
                    {s.payout?.externalPaymentRef ? ` · Ref: ${s.payout.externalPaymentRef}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                  <p className="mt-1 text-[0.8125rem] font-bold text-[var(--ink)]">{formatMoney(s.paidAmount, currency)} / {formatMoney(s.feeAmount, currency)}</p>
                  {!s.isPaid && s.paidAmount > 0 ? (
                    <p className="text-[0.75rem] font-semibold text-[var(--ink-muted)]">Outstanding {formatMoney(s.balance, currency)}</p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        }}
      />
    </ListPageLayout>
  );
}
