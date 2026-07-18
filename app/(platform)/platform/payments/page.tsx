import Link from "next/link";
import { getRecentBillingEvents, getTotalRevenue, getMonthlyRevenue } from "@/lib/billing-events";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATMediumDate } from "@/lib/date-eat";
import { PLATFORM_ROUTES } from "@/lib/platform/routes";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { planLabel } from "@/lib/plan-labels";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePlatformAdmin();

  const params = await searchParams;
  const page = parsePage(params.page);

  const [events, totalRevenue, monthRevenue] = await Promise.all([
    getRecentBillingEvents(100),
    getTotalRevenue(),
    getMonthlyRevenue(),
  ]);

  // KPI is computed from the whole fetched dataset before slicing for display.
  const successfulCount = events.filter(
    (e) => e.status === "successful" && e.event === "charge.completed",
  ).length;

  const pageView = paginationView(page, events.length);
  const pageRows = events.slice(pageView.skip, pageView.skip + pageView.take);
  const paymentsHref = pageHrefBuilder("/platform/payments", {});

  const fmt = (d: Date) => formatEATMediumDate(d);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--ink)]">Payments</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Payment events recorded from Pesapal webhooks</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Revenue This Month</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{formatMoney(monthRevenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{formatMoney(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Successful Transactions</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{successfulCount}</p>
        </div>
      </div>

      {/* Event log */}
      <DataTable
        rows={pageRows}
        getRowKey={(e) => e.id}
        empty="No payment events recorded yet. Events are logged when Pesapal IPN callbacks fire."
        columns={[
          {
            key: "date",
            header: "Date",
            className: "text-[var(--ink-muted)] whitespace-nowrap",
            cell: (e) => fmt(e.createdAt),
          },
          {
            key: "org",
            header: "Organisation",
            cell: (e) => (
              <Link href={PLATFORM_ROUTES.org(e.orgId)} className="font-medium text-[var(--ink)] hover:underline">
                {e.orgName ?? e.orgId}
              </Link>
            ),
          },
          {
            key: "event",
            header: "Event",
            className: "text-[var(--ink)]",
            cell: (e) => e.event,
          },
          {
            key: "status",
            header: "Status",
            cell: (e) => (
              <StatusBadge tone={e.status === "successful" ? "success" : e.status === "cancelled" ? "neutral" : "danger"}>
                {e.status}
              </StatusBadge>
            ),
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            className: "font-mono",
            cell: (e) => (e.amount > 0 ? formatMoney(e.amount, normalizeCurrency(e.currency, "UGX")) : "—"),
          },
          {
            key: "plan",
            header: "Plan",
            className: "text-[var(--ink-muted)]",
            cell: (e) => (e.plan ? planLabel(e.plan) : "—"),
          },
          {
            key: "reference",
            header: "Reference",
            className: "font-mono text-xs text-[var(--ink-muted)] max-w-[160px] truncate",
            cell: (e) => e.txRef ?? "—",
          },
        ]}
      />

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="events"
        hrefForPage={paymentsHref}
      />
    </div>
  );
}
