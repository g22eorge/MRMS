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
import { routeLabel } from "@/lib/nav/registry";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";

/* ─── nav groups ─────────────────────────────────────────────────────────── */

// Tile labels come from the canonical route registry (lib/nav/registry.ts).
type TileItem = { label: string; href: string; icon: string; color: string };

const tile = (href: string, icon: string, color: string): TileItem => ({
  href,
  label: routeLabel(href),
  icon,
  color,
});

const GROUPS: { label: string; tiles: TileItem[] }[] = [
  {
    label: "Documents",
    tiles: [
      tile("/documents/invoices",     "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M16 13H8|M16 17H8|M10 9H8",  "text-amber-500"),
      tile("/documents/receipts",     "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z|M9 12h6|M9 16h6|M9 8h2",  "text-emerald-500"),
      tile("/documents/quotations",   "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M10 13h4|M8 17h8|M8 9h2",      "text-teal-500"),
      tile("/documents/credit-notes", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M9 15l2 2 4-4|M9 9h6",         "text-cyan-500"),
      tile("/documents/refunds",      "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8|M3 3v5h5|M12 7v5l4 2",                             "text-orange-400"),
    ],
  },
  {
    label: "Transactions",
    tiles: [
      tile("/finance/expenses",  "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-8 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z", "text-rose-500"),
      tile("/payout-followups",  "M12 2v20|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",                                     "text-sky-500"),
      tile("/pos/shifts",        "M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z|M3 9l2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9|M12 3v6", "text-violet-500"),
      tile("/finance/recurring", "M17 1l4 4-4 4|M3 11V9a4 4 0 0 1 4-4h14|M7 23l-4-4 4-4|M21 13v2a4 4 0 0 1-4 4H3",               "text-purple-500"),
    ],
  },
  {
    label: "Accounting",
    tiles: [
      tile("/finance/bank",      "M3 22h18|M6 18V9|M10 18V9|M14 18V9|M18 18V9|M12 2l9 7H3l9-7Z",                                   "text-blue-500"),
      tile("/finance/accounts",  "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",         "text-indigo-500"),
      tile("/finance/journal",   "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M8 13h2|M14 13h2|M8 17h2|M14 17h2", "text-slate-400"),
      tile("/finance/tax-rates", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M9 13l6 0|M9 9h1|M9 17h1", "text-orange-500"),
    ],
  },
  {
    label: "Insights",
    tiles: [
      tile("/reports",                       "M3 3v18h18|m19 9-5 5-4-4-3 3",                                                                          "text-pink-500"),
      tile("/finance/reports/pl",            "M3 3v18h18|M7 16l4-8 4 4 4-6",                                                                          "text-emerald-500"),
      tile("/finance/reports/balance-sheet", "M12 2v20|M2 12h20|M17 7l-5 5-5-5|M7 17l5-5 5 5",                                                       "text-sky-400"),
      tile("/targets",                       "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z|M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z|M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", "text-yellow-500"),
      tile("/ai-insights",                   "M12 2a5 5 0 0 1 5 5c0 2.76-2.24 5-5 5S7 9.76 7 7a5 5 0 0 1 5-5z|M2 22c0-4.41 4.03-8 9-8 1.45 0 2.82.35 4 .96|M18 14l-1 4h-2l-1-4|M16 22v-8|M20 18h-8", "text-fuchsia-500"),
    ],
  },
];

function NavIcon({ d, color }: { d: string; color: string }) {
  const paths = d.split("|");
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={color} aria-hidden="true">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

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

      {/* ── Full nav groups ────────────────────────────────────────────── */}
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
              {group.label}
            </h2>
            {/* Mobile: 2-col list rows */}
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              {group.tiles.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="dc-card flex items-center gap-3 px-4 py-3 transition active:opacity-75"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-strong)]">
                    <NavIcon d={item.icon} color={item.color} />
                  </span>
                  <span className="text-[13px] font-semibold leading-snug text-[var(--ink)]">{item.label}</span>
                </Link>
              ))}
            </div>
            {/* Desktop: icon grid */}
            <div className="hidden gap-2 lg:grid lg:grid-cols-6">
              {group.tiles.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="dc-card flex flex-col items-center gap-2 px-2 py-4 text-center transition hover:shadow-[var(--dc-shadow-hover)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel-strong)]">
                    <NavIcon d={item.icon} color={item.color} />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight text-[var(--ink)]">{item.label}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

    </div>
  );
}
