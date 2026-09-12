export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { orgDb } from "@/lib/db";
import { requireOrgSession } from "@/lib/org-context";
import { formatMoney, formatMoneyCompact } from "@/lib/currency";
import {
  loadCashCollectionsByChannel,
  loadExpensesTotal,
  loadReceivablesTotal,
} from "@/lib/finance/reconciliation";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";

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
    payoutsTotalMtd,
  ] = await Promise.all([
    loadExpensesTotal({ orgId, range: { start: monthStart } }).catch(() => 0),
    loadCashCollectionsByChannel({ orgId, baseCurrency: currency, range: { start: monthStart } }).catch(() => ({ total: 0, repairs: 0, products: 0, corporate: 0, unallocated: 0 })),
    loadCashCollectionsByChannel({ orgId, baseCurrency: currency, range: { start: lastMonthStart, end: lastMonthEnd } }).catch(() => ({ total: 0 })),
    loadReceivablesTotal(orgId).catch(() => ({ total: 0, invoiceBalance: 0, saleBalance: 0, invoiceCount: 0, saleCount: 0 })),

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

  const payoutsThisMonth = payoutsTotalMtd._sum.amount ?? 0;

  /* ── channel bars ─────────────────────────────────────────────────────── */
  const channels = [
    { label: "Repairs",     value: collectionsMtd.repairs,     color: "bg-sky-500"    },
    { label: "Products",    value: collectionsMtd.products,    color: "bg-[var(--accent)]" },
    { label: "Corporate",   value: collectionsMtd.corporate,   color: "bg-amber-500"  },
    { label: "Unallocated", value: collectionsMtd.unallocated, color: "bg-slate-400"  },
  ].filter(c => c.value > 0);

  const revPctStr = revPct !== null ? `${revPct >= 0 ? "+" : "-"}${Math.abs(revPct)}% vs last month` : null;
  /** Money for the tight mobile strip — currency lives in the header line. */
  const compactAmount = (value: number) => formatMoneyCompact(value, currency).replace(`${currency} `, "");

  return (
    <div className="space-y-4 pb-24 lg:pb-8">

      {/* ══ MOBILE HEADER ══ */}
      <div className="space-y-3 lg:hidden">
        <div>
          <h1 className="text-[1.375rem] font-black text-[var(--ink)]">Finance</h1>
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">
            {now.toLocaleDateString("en-UG", { month: "long", year: "numeric" })} · amounts in {currency}
          </p>
        </div>
        <div className="grid grid-cols-4 divide-x divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)]">
          {([
            { label: "In", value: compactAmount(revTotal) },
            { label: "Out", value: compactAmount(expTotal) },
            { label: "Net", value: compactAmount(netMtd) },
            { label: "Owed", value: compactAmount(receivables.total) },
          ] as const).map(({ label, value }) => (
            <div key={label} className="min-w-0 px-1.5 py-3 text-center">
              <p className="truncate text-[1.0625rem] font-black leading-none tabular-nums text-[var(--ink)]">{value}</p>
              <p className="mt-1 text-[0.6875rem] text-[var(--ink-muted)]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ DESKTOP HEADER ══ */}
      <div className="hidden lg:block">
        <PageHeader
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
            label: "Money in this month",
            value: formatMoney(revTotal, currency),
            sub: revPctStr ?? "collections received",
            tone: "good",
            muted: revTotal === 0,
          },
          {
            key: "out",
            label: "Money out this month",
            value: formatMoney(expTotal, currency),
            sub: `${formatMoneyCompact(payoutsThisMonth, currency)} tech payouts`,
            tone: "crit",
            muted: expTotal === 0,
          },
          {
            key: "net",
            label: "Net this month",
            value: formatMoney(netMtd, currency),
            sub: netMtd >= 0 ? "positive cash flow" : "cash flow negative",
            tone: netMtd >= 0 ? "good" : "crit",
            muted: netMtd === 0,
          },
          {
            key: "receivables",
            label: "Owed to you",
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
        <div className="dc-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Collection mix</p>
            <p className="text-[0.75rem] text-[var(--ink-muted)]">{formatMoney(revTotal, currency)} collected</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-strong)]">
              {channels.map((c) => (
                <div key={c.label} className={`h-full ${c.color}`} style={{ width: `${Math.round((c.value / revTotal) * 100)}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {channels.map((c) => (
                <span key={c.label} className="flex items-center gap-1.5 text-[0.75rem] text-[var(--ink-muted)]">
                  <span className={`h-2 w-2 rounded-full ${c.color}`} />
                  {c.label} {Math.round((c.value / revTotal) * 100)}%
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Module navigation now lives in the finance hub tabs (shell), so the
          redundant launcher grid was removed — the overview stays focused on
          the numbers + what needs action. */}
    </div>
  );
}
