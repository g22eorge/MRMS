import Link from "next/link";
import { getRecentBillingEvents, getTotalRevenue, getMonthlyRevenue } from "@/lib/billing-events";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATMediumDate } from "@/lib/date-eat";
import { PLATFORM_ROUTES } from "@/lib/platform/routes";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { planLabel } from "@/lib/plan-labels";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import {parsePage, paginationView, pageHrefBuilder, PAGE_SIZE, parsePageSize, sizeHrefBuilder} from "@/lib/pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; }>;
}) {
  await requirePlatformAdmin();

  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);

  const [events, totalRevenue, monthRevenue] = await Promise.all([
    getRecentBillingEvents(100),
    getTotalRevenue(),
    getMonthlyRevenue(),
  ]);

  // KPI is computed from the whole fetched dataset before slicing for display.
  const successfulCount = events.filter(
    (e) => e.status === "successful" && e.event === "charge.completed",
  ).length;

  const pageView = paginationView(page, events.length, pageSize);
  const pageRows = events.slice(pageView.skip, pageView.skip + pageView.take);
  const paymentsHrefFilters = {
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const paymentsHref = pageHrefBuilder("/platform/payments", paymentsHrefFilters);
  const paymentsHrefSize = sizeHrefBuilder("/platform/payments", paymentsHrefFilters);

  const fmt = (d: Date) => formatEATMediumDate(d);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--ink)]">Payments</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Payment events recorded from Pesapal webhooks</p>
      </div>

      {/* These three answer the questions this table cannot: whether the
          deployment can take money at all, what the organisations look like
          against their subscriptions, and whether a specific Pesapal
          transaction was actually honoured. They were reachable only by typing
          the URL, which is the same as not existing. */}
      <div className="flex flex-wrap gap-2">
        <a href="/api/admin/pesapal-health"
           className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[0.8125rem] font-semibold text-[var(--ink)] hover:border-[var(--accent)] transition-colors">
          Payment readiness check
          <span className="block text-[0.75rem] font-normal text-[var(--ink-muted)]">Can this deployment take a real payment?</span>
        </a>
        <a href="/api/admin/billing-reconcile"
           className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[0.8125rem] font-semibold text-[var(--ink)] hover:border-[var(--accent)] transition-colors">
          Billing reconciliation
          <span className="block text-[0.75rem] font-normal text-[var(--ink-muted)]">Subscriptions against recorded events</span>
        </a>
        <a href="/api/admin/verify-payments"
           className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[0.8125rem] font-semibold text-[var(--ink)] hover:border-[var(--accent)] transition-colors">
          Verify Pesapal transactions
          <span className="block text-[0.75rem] font-normal text-[var(--ink-muted)]">Paste tracking ids — was each one honoured?</span>
        </a>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Revenue This Month</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{formatMoney(monthRevenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{formatMoney(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Successful Transactions</p>
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
            className: "mono",
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
            className: "mono text-[0.75rem] text-[var(--ink-muted)] max-w-[160px] truncate",
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
          pageSize={pageSize}
          hrefForSize={paymentsHrefSize}
      />
    </div>
  );
}
