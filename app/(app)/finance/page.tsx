export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { requireOrgSession } from "@/lib/org-context";
import { formatMoney, formatMoneyCompact } from "@/lib/currency";
import {
  loadCashCollectionsByChannel,
  loadExpensesTotal,
  loadReceivablesTotal,
} from "@/lib/finance/reconciliation";
import { getTechnicianPayoutTotalsByJobIds } from "@/lib/payouts";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";

function Icon({ d, cls }: { d: string; cls?: string }) {
  const paths = d.split("|");
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden="true">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

export default async function FinancePage() {
  const { user, orgId, org } = await requireOrgSession();
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const db = orgDb(orgId);
  const now = new Date();
  const currency = org.baseCurrency;

  const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);

  /* ── parallel data fetch ──────────────────────────────────────────────── */
  const [
    expensesTotal,
    collectionsMtd,
    collectionsLastMonth,
    receivables,
    overdueInvoices,
    pendingPayouts,
    payoutsTotalMtd,
  ] = await Promise.all([
    loadExpensesTotal({ orgId, range: { start: monthStart } }).catch(() => 0),
    loadCashCollectionsByChannel({ orgId, baseCurrency: currency, range: { start: monthStart } }).catch(() => ({ total: 0, repairs: 0, products: 0, corporate: 0, unallocated: 0 })),
    loadCashCollectionsByChannel({ orgId, baseCurrency: currency, range: { start: lastMonthStart, end: lastMonthEnd } }).catch(() => ({ total: 0 })),
    loadReceivablesTotal(orgId).catch(() => ({ total: 0, invoiceBalance: 0, saleBalance: 0, invoiceCount: 0, saleCount: 0 })),

    // Overdue invoices: issued/draft with a due date in the past
    prisma.invoice.findMany({
      where: {
        orgId,
        status: { in: ["ISSUED", "DRAFT"] },
        dueDate: { lt: now },
      },
      select: { totalAmount: true, paidAmount: true, dueDate: true, invoiceNumber: true },
    }).catch(() => []),

    // Jobs with external tech cost not yet paid out (pending payout)
    db.job.findMany({
      where: {
        orgId,
        externalPaid: false,
        OR: [
          { externalTechFee: { gt: 0 } },
          { externalTechBill: { gt: 0 } },
        ],
      },
      select: { id: true, externalTechFee: true, externalTechBill: true },
    }).catch(() => []),

    // Tech payouts this month
    db.technicianPayout.aggregate({
      where: { orgId, paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: null } })),
  ]);

  /* ── derived values ───────────────────────────────────────────────────── */
  const revTotal  = collectionsMtd.total;
  const expTotal  = expensesTotal;
  const netMtd    = revTotal - expTotal;
  const revPct    = collectionsLastMonth.total > 0
    ? Math.round(((revTotal - collectionsLastMonth.total) / collectionsLastMonth.total) * 100)
    : null;

  const overdueTotal = overdueInvoices.reduce((s, inv) => s + Math.max(0, inv.totalAmount - inv.paidAmount), 0);
  const overdueCount = overdueInvoices.length;

  const pendingPayoutTotals = await getTechnicianPayoutTotalsByJobIds(pendingPayouts.map((job: { id: string }) => job.id));
  const pendingPayoutTotal = pendingPayouts.reduce((s: number, j: { id: string; externalTechFee: number | null; externalTechBill: number | null }) => {
    const cost = j.externalTechBill ?? j.externalTechFee ?? 0;
    const paid = pendingPayoutTotals.get(j.id)?.paidAmount ?? 0;
    return s + Math.max(0, cost - paid);
  }, 0);
  const pendingPayoutCount = pendingPayouts.length;

  const payoutsThisMonth = payoutsTotalMtd._sum.amount ?? 0;

  const hasActions = overdueCount > 0 || pendingPayoutCount > 0;

  /* ── channel bars ─────────────────────────────────────────────────────── */
  const channels = [
    { label: "Repairs",     value: collectionsMtd.repairs,     color: "bg-sky-500"    },
    { label: "Products",    value: collectionsMtd.products,    color: "bg-violet-500" },
    { label: "Corporate",   value: collectionsMtd.corporate,   color: "bg-amber-500"  },
    { label: "Unallocated", value: collectionsMtd.unallocated, color: "bg-slate-400"  },
  ].filter(c => c.value > 0);

  const revPctStr = revPct !== null ? `${revPct >= 0 ? "+" : "-"}${Math.abs(revPct)}% vs last month` : null;
  /** Money for the tight mobile strip — currency lives in the header line. */
  const compactAmount = (value: number) => formatMoneyCompact(value, currency).replace(`${currency} `, "");

  return (
    <div className="space-y-5 pb-24 lg:pb-8">

      {/* ══ MOBILE HEADER ══ */}
      <div className="space-y-3 lg:hidden">
        <div>
          <h1 className="text-[22px] font-black text-[var(--ink)]">Finance</h1>
          <p className="text-[13px] text-[var(--ink-muted)]">
            {now.toLocaleDateString("en-UG", { month: "long", year: "numeric" })} · amounts in {currency}
          </p>
        </div>
        <div className="grid grid-cols-4 divide-x divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)]">
          {([
            { label: "In", value: compactAmount(revTotal) },
            { label: "Out", value: compactAmount(expTotal) },
            { label: "Net", value: compactAmount(netMtd) },
            { label: "Owed", value: compactAmount(receivables.total) },
          ] as const).map(({ label, value }) => (
            <div key={label} className="min-w-0 px-1.5 py-3 text-center">
              <p className="truncate text-[17px] font-black leading-none tabular-nums text-[var(--ink)]">{value}</p>
              <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ DESKTOP HEADER ══ */}
      <div className="hidden lg:block">
        <PageHeader
          eyebrow="Finance"
          title="Finance Hub"
          description={`Cash position for ${now.toLocaleDateString("en-UG", { month: "long", year: "numeric" })}`}
          actions={<Button href="/finance/reports/pl" variant="secondary" size="sm">P&amp;L →</Button>}
        />
      </div>

      {/* ══ DESKTOP: KPI cards ══ */}
      <StatCards
        columns={4}
        cards={[
          {
            key: "in",
            label: "Cash in MTD",
            value: formatMoney(revTotal, currency),
            sub: revPctStr ?? "collections received",
            tone: "good",
            muted: revTotal === 0,
          },
          {
            key: "out",
            label: "Cash out MTD",
            value: formatMoney(expTotal, currency),
            sub: `${formatMoneyCompact(payoutsThisMonth, currency)} tech payouts`,
            tone: "crit",
            muted: expTotal === 0,
          },
          {
            key: "net",
            label: "Net MTD",
            value: formatMoney(netMtd, currency),
            sub: netMtd >= 0 ? "positive cash flow" : "cash flow negative",
            tone: netMtd >= 0 ? "good" : "crit",
            muted: netMtd === 0,
          },
          {
            key: "receivables",
            label: "Receivables",
            value: formatMoney(receivables.total, currency),
            sub: `${receivables.invoiceCount + receivables.saleCount} open invoices`,
            tone: "warn",
            muted: receivables.total === 0,
            href: "/documents/invoices",
          },
        ]}
      />

      {/* ── Collection mix ── */}
      {revTotal > 0 && channels.length > 0 ? (
        <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Collection mix</p>
            <p className="text-[12px] text-[var(--ink-muted)]">{formatMoney(revTotal, currency)} collected</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-strong)]">
              {channels.map((c) => (
                <div key={c.label} className={`h-full ${c.color}`} style={{ width: `${Math.round((c.value / revTotal) * 100)}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {channels.map((c) => (
                <span key={c.label} className="flex items-center gap-1.5 text-[12px] text-[var(--ink-muted)]">
                  <span className={`h-2 w-2 rounded-full ${c.color}`} />
                  {c.label} {Math.round((c.value / revTotal) * 100)}%
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Action Required ────────────────────────────────────────────── */}
      {hasActions && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 divide-y divide-red-500/15 overflow-hidden">
          <div className="px-4 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-500">Action Required</p>
          </div>

          {overdueCount > 0 && (
            <Link href="/documents/invoices" className="flex items-center justify-between px-4 py-3 hover:bg-red-500/5 transition-colors">
              <div className="flex items-center gap-2.5">
                <Icon d="M12 9v4|M12 17h.01|M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" cls="text-red-500 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-red-500">{overdueCount} overdue invoice{overdueCount > 1 ? "s" : ""}</p>
                  <p className="text-[12px] text-red-400">{formatMoney(overdueTotal, currency)} outstanding past due date</p>
                </div>
              </div>
              <Icon d="M9 18l6-6-6-6" cls="text-red-400 shrink-0" />
            </Link>
          )}

          {pendingPayoutCount > 0 && (
            <Link href="/payout-followups" className="flex items-center justify-between px-4 py-3 hover:bg-red-500/5 transition-colors">
              <div className="flex items-center gap-2.5">
                <Icon d="M12 2v20|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" cls="text-amber-500 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-amber-500">{pendingPayoutCount} unpaid tech payout{pendingPayoutCount > 1 ? "s" : ""}</p>
                  <p className="text-[12px] text-amber-400">{formatMoney(pendingPayoutTotal, currency)} owed to external technicians</p>
                </div>
              </div>
              <Icon d="M9 18l6-6-6-6" cls="text-amber-400 shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* Module navigation now lives in the finance hub tabs (shell), so the
          redundant launcher grid was removed — the overview stays focused on
          the numbers + what needs action. */}
    </div>
  );
}
