import Link from "next/link";
import { redirect } from "next/navigation";

import { ProgressiveList } from "@/components/mobile/ProgressiveList";
import { formatMoney, getAppCurrency } from "@/lib/currency";
import { getJobPayoutsByIds, hasJobPayoutColumns } from "@/lib/payouts";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

type SearchParams = {
  q?: string;
  paid?: string;
  month?: string;
};

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
  const { session, user } = await getCurrentUserRole();
  if (user.role !== "TECHNICIAN_EXTERNAL") {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const month = parseMonth(filters.month);

  const jobs = await prisma.job.findMany({
    where: {
      assignedToId: session.user.id,
      repairPath: "EXTERNAL",
      ...(filters.q
        ? {
            OR: [
              { jobNumber: { contains: filters.q } },
              { brand: { contains: filters.q } },
              { model: { contains: filters.q } },
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
    },
    orderBy: { receivedAt: "desc" },
  });

  const payoutColumnsReady = await hasJobPayoutColumns();
  const payouts = await getJobPayoutsByIds(jobs.map((job) => job.id));

  const currency = getAppCurrency();
  const total = jobs.reduce((sum, job) => sum + (payouts.get(job.id)?.externalTechFee ?? 0), 0);
  const paid = jobs
    .filter((job) => payouts.get(job.id)?.externalPaid)
    .reduce((sum, job) => sum + (payouts.get(job.id)?.externalTechFee ?? 0), 0);
  const unpaid = jobs
    .filter((job) => !payouts.get(job.id)?.externalPaid)
    .reduce((sum, job) => sum + (payouts.get(job.id)?.externalTechFee ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="panel-shadow sticky top-14 z-20 grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 py-2 md:hidden">
        <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Total</p>
          <p className="text-sm font-semibold">{formatMoney(total, currency)}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Paid</p>
          <p className="text-sm font-semibold text-emerald-700">{formatMoney(paid, currency)}</p>
        </div>
        <div className="col-span-2 min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Outstanding</p>
          <p className="text-sm font-semibold text-amber-700">{formatMoney(unpaid, currency)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!payoutColumnsReady ? (
            <p className="mt-1 text-xs text-amber-700">Payout columns are not migrated yet in this environment. Run latest Prisma migrations.</p>
          ) : null}
        </div>
        <Link href="/dashboard" className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
          Back to dashboard
        </Link>
      </div>

      <form className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:hidden">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search job # / device and press Enter"
          className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2"
        />
      </form>

      <form className="panel-shadow hidden gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:grid md:grid-cols-4">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search job # / device"
          className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1"
        />
        <select
          name="paid"
          defaultValue={filters.paid}
          className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1"
        >
          <option value="">All statuses</option>
          <option value="paid">Paid only</option>
          <option value="unpaid">Unpaid only</option>
        </select>
        <input
          type="month"
          name="month"
          defaultValue={filters.month}
          className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1"
        />
        <div className="flex gap-2">
          <button className="rounded-md border border-[var(--line)] bg-white px-3 py-2">Apply</button>
          <Link href="/technicians/payouts" className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
            Reset
          </Link>
        </div>
      </form>

      <div className="hidden gap-3 md:grid md:grid-cols-3">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Total in view</p>
          <p className="text-2xl font-semibold">{formatMoney(total, currency)}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Paid</p>
          <p className="text-2xl font-semibold text-emerald-700">{formatMoney(paid, currency)}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Outstanding</p>
          <p className="text-2xl font-semibold text-amber-700">{formatMoney(unpaid, currency)}</p>
        </div>
      </div>

      <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        {jobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No payout records found for these filters.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            <ProgressiveList initialCount={5} step={5}>
              {jobs.map((job) => (
                <li key={job.id} className="border-b border-[var(--line)] py-2">
                <details>
                  <summary className="list-none">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{job.jobNumber} - {job.brand} {job.model}</p>
                        <p className="text-xs text-[var(--ink-muted)]">{job.status} {job.completedAt ? `• completed ${job.completedAt.toLocaleDateString()}` : ""}</p>
                        {payouts.get(job.id)?.externalPaymentRef ? (
                          <p className="text-[11px] text-[var(--ink-muted)]">Ref: {payouts.get(job.id)?.externalPaymentRef}</p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(payouts.get(job.id)?.externalTechFee ?? 0, currency)}</p>
                        <p className={`text-xs ${payouts.get(job.id)?.externalPaid ? "text-emerald-700" : "text-amber-700"}`}>
                          {payouts.get(job.id)?.externalPaid ? "Paid" : "Unpaid"}
                        </p>
                      </div>
                    </div>
                  </summary>
                  <div className="mt-2 text-xs text-[var(--ink-muted)]">
                    {payouts.get(job.id)?.externalPaidAt ? (
                      <p>Paid on {payouts.get(job.id)?.externalPaidAt?.toLocaleDateString()}</p>
                    ) : (
                      <p>Pending payment</p>
                    )}
                    {payouts.get(job.id)?.externalPaymentRef ? (
                      <p>Ref: {payouts.get(job.id)?.externalPaymentRef}</p>
                    ) : null}
                  </div>
                </details>
                </li>
              ))}
            </ProgressiveList>
          </ul>
        )}
      </div>
    </div>
  );
}
