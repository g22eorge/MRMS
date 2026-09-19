export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { can } from "@/lib/permissions";
import { orgDb } from "@/lib/db";
import { requireOrgSession } from "@/lib/org-context";
import { formatMoney, formatMoneyCompact, rowToBase } from "@/lib/currency";
import { resolveTechCost } from "@/lib/billing";
import { getTechnicianPayoutTotalsByJobIds } from "@/lib/payouts";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import {
  loadCashCollectionsByChannel,
  loadExpensesTotal,
  loadReceivablesTotal,
} from "@/lib/finance/reconciliation";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { user, orgId, org } = await requireOrgSession();
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const sp = await searchParams;
  // Cash-flow window: 6 months, 1 year (monthly) or 3 years (quarterly).
  const rangeKey = sp.range === "1y" ? "1y" : sp.range === "3y" ? "3y" : "6m";

  const db = orgDb(orgId);
  const now = new Date();
  const currency = org.baseCurrency;

  const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);

  /* ── parallel data fetch ──────────────────────────────────────────────── */
  const weekOut = new Date(now.getTime() + 7 * 86_400_000);
  const [
    expensesTotal,
    collectionsMtd,
    collectionsLastMonth,
    receivables,
    payoutsTotalMtd,
    billStats,
    expenseStats,
    overdueInvoices,
    techDueJobs,
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

    // Open supplier bills: balance + overdue + due-week counts
    db.supplierBill.findMany({
      where: { orgId, status: { in: ["POSTED", "PART_PAID"] } },
      select: { totalAmount: true, paidAmount: true, currency: true, exchangeRateToBase: true, dueAt: true },
    }).catch(() => []),
    // Open expenses (owed, not spent)
    db.expense.findMany({
      where: { orgId, paidAt: null },
      select: { amount: true, currency: true, exchangeRateToBase: true, dueAt: true, createdAt: true },
    }).catch(() => []),
    // Overdue invoices needing chase
    db.invoice.findMany({
      where: { orgId, status: "ISSUED", dueDate: { lt: now } },
      select: { totalAmount: true, paidAmount: true },
    }).catch(() => []),
    // Outstanding tech dues
    db.job.findMany({
      where: { orgId, repairPath: "EXTERNAL", externalPaid: false, status: { in: filterSupportedJobStatuses(["READY_FOR_PICKUP", "COMPLETED", "DELIVERED"]) } },
      select: { id: true, externalTechFee: true, externalTechBill: true },
    }).catch(() => []),
  ]);

  /* ── derived values ───────────────────────────────────────────────────── */
  const revTotal  = collectionsMtd.total;
  const expTotal  = expensesTotal;
  const netMtd    = revTotal - expTotal;
  const revPct    = collectionsLastMonth.total > 0
    ? Math.round(((revTotal - collectionsLastMonth.total) / collectionsLastMonth.total) * 100)
    : null;

  const payoutsThisMonth = payoutsTotalMtd._sum.amount ?? 0;

  /* ── cash-flow chart (collections vs paid expenses per period) ──────────── */
  const periodCount = rangeKey === "6m" ? 6 : 12;
  const periodMonths = rangeKey === "3y" ? 3 : 1;
  const cashFlowMonths = Array.from({ length: periodCount }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (periodCount - 1 - i) * periodMonths, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - (periodCount - 1 - i) * periodMonths + periodMonths, 1);
    const label = periodMonths === 1
      ? start.toLocaleDateString("en-UG", { month: "short" })
      : `Q${Math.floor(start.getMonth() / 3) + 1} '${String(start.getFullYear()).slice(2)}`;
    return { key: `${label}-${start.getFullYear()}-${start.getMonth()}`, label, start, end, inflow: 0, outflow: 0 };
  });
  await Promise.all(
    cashFlowMonths.map(async (m) => {
      const [collections, outgo] = await Promise.all([
        loadCashCollectionsByChannel({ orgId, baseCurrency: currency, range: { start: m.start, end: m.end } }).catch(() => ({ total: 0 })),
        loadExpensesTotal({ orgId, range: { start: m.start, end: m.end } }).catch(() => 0),
      ]);
      m.inflow = collections.total;
      m.outflow = outgo;
    }),
  );
  const cashFlowMax = Math.max(1, ...cashFlowMonths.flatMap((m) => [m.inflow, m.outflow]));
  const cashFlowTotalIn = cashFlowMonths.reduce((s, m) => s + m.inflow, 0);
  const cashFlowTotalOut = cashFlowMonths.reduce((s, m) => s + m.outflow, 0);

  /* ── chart geometry (pure SVG, no client JS) ────────────────────────────── */
  const CH = { L: 44, R: 592, T: 10, B: 188 };
  const chStep = (CH.R - CH.L) / Math.max(1, cashFlowMonths.length);
  const chX = (i: number) => CH.L + i * chStep + chStep / 2;
  const chY = (v: number) => CH.B - Math.max(0, Math.round((v / cashFlowMax) * (CH.B - CH.T)));
  // Smooth curve through points (Catmull-Rom → Bézier).
  function chSmooth(pts: Array<readonly [number, number]>) {
    if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }
  const chInLine = chSmooth(cashFlowMonths.map((m, i) => [chX(i), chY(m.inflow)] as const));
  const chNet = cashFlowMonths.map((m) =>
    Math.min(CH.B, Math.max(CH.T, CH.B - Math.round(((m.inflow - m.outflow) / cashFlowMax) * (CH.B - CH.T)))),
  );
  const chTicks = [0.25, 0.5, 0.75, 1].map((f) => ({
    y: CH.B - Math.round(f * (CH.B - CH.T)),
    v: formatMoneyCompact(Math.round(f * cashFlowMax), currency).replace(`${currency} `, ""),
  }));

  /* ── payables + attention (base currency) ───────────────────────────────── */
  const toBase = (amount: number, curr?: string | null, rate?: number | null) =>
    rowToBase({ amount, currency: curr ?? currency, exchangeRateToBase: rate ?? null }, currency);
  const billsBase = billStats.reduce((s, b) => s + toBase(b.totalAmount - b.paidAmount, b.currency, b.exchangeRateToBase), 0);
  const overdueBills = billStats.filter((b) => b.dueAt && b.dueAt.getTime() < now.getTime());
  const overdueBillsBase = overdueBills.reduce((s, b) => s + toBase(b.totalAmount - b.paidAmount, b.currency, b.exchangeRateToBase), 0);
  const dueWeekBills = billStats.filter((b) => b.dueAt && b.dueAt.getTime() >= now.getTime() && b.dueAt.getTime() <= weekOut.getTime()).length;
  const expensesBase = expenseStats.reduce((s, e) => s + toBase(e.amount, e.currency, e.exchangeRateToBase), 0);
  const overdueInvoicesBase = overdueInvoices.reduce((s, i) => s + Math.max(0, i.totalAmount - i.paidAmount), 0);
  const techPaidTotals = await getTechnicianPayoutTotalsByJobIds(techDueJobs.map((j) => j.id)).catch(() => new Map<string, { paidAmount: number }>());
  const techDueBase = techDueJobs.reduce((s, j) => {
    const paid = techPaidTotals.get(j.id)?.paidAmount ?? 0;
    return s + Math.max(0, resolveTechCost(j.externalTechFee, j.externalTechBill) - paid);
  }, 0);
  const payablesBase = billsBase + expensesBase + techDueBase;

  type AttentionItem = { label: string; detail: string; href: string; tone: "red" | "amber" };
  const attentionItems: AttentionItem[] = [
    overdueBills.length > 0 ? {
      label: `${overdueBills.length} overdue bill${overdueBills.length !== 1 ? "s" : ""}`,
      detail: `${formatMoneyCompact(overdueBillsBase, currency)} past due`,
      href: "/payables?section=bills",
      tone: "red",
    } : null,
    dueWeekBills > 0 ? {
      label: `${dueWeekBills} bill${dueWeekBills !== 1 ? "s" : ""} due within 7 days`,
      detail: "Maturing this week",
      href: "/payables?section=bills",
      tone: "amber",
    } : null,
    expenseStats.length > 0 ? {
      label: `${expenseStats.length} open expense${expenseStats.length !== 1 ? "s" : ""}`,
      detail: `${formatMoneyCompact(expensesBase, currency)} owed`,
      href: "/finance/expenses?status=unpaid",
      tone: "amber",
    } : null,
    overdueInvoices.length > 0 ? {
      label: `${overdueInvoices.length} overdue invoice${overdueInvoices.length !== 1 ? "s" : ""}`,
      detail: `${formatMoneyCompact(overdueInvoicesBase, currency)} to chase`,
      href: "/documents/invoices",
      tone: "red",
    } : null,
    techDueJobs.length > 0 ? {
      label: `${techDueJobs.length} tech payout${techDueJobs.length !== 1 ? "s" : ""} pending`,
      detail: `${formatMoneyCompact(techDueBase, currency)} to pay`,
      href: "/payables?section=tech",
      tone: "amber",
    } : null,
  ].filter((x): x is AttentionItem => x !== null);

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
            { label: "Due", value: compactAmount(receivables.total) },
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
        columns={5}
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
            label: "Accounts Receivable",
            value: formatMoney(receivables.total, currency),
            sub: `${receivables.invoiceCount + receivables.saleCount} open invoices`,
            tone: "warn",
            muted: receivables.total === 0,
            href: "/documents/invoices",
          },
          {
            key: "payables",
            label: "Accounts Payable",
            value: formatMoney(payablesBase, currency),
            sub: "bills + open expenses + tech",
            tone: payablesBase > 0 ? "warn" : undefined,
            muted: payablesBase === 0,
            href: "/payables",
          },
        ]}
      />

      {/* ── Needs action ── */}
      {attentionItems.length > 0 ? (
        <section aria-label="Needs action" className="overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/[0.06]">
          <p className="px-4 pt-2.5 text-[0.6875rem] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Needs action
          </p>
          <div className="mt-1 divide-y divide-amber-500/15">
            {attentionItems.map((item) => (
              <Link key={item.label} href={item.href} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition active:bg-amber-500/10 hover:bg-amber-500/5">
                <span className={`mt-0 h-1.5 w-1.5 shrink-0 rounded-full ${item.tone === "red" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] font-semibold text-[var(--ink)]">{item.label}</span>
                  <span className="block text-[0.75rem] text-[var(--ink-muted)]">{item.detail}</span>
                </span>
                <span className="shrink-0 text-[0.8125rem] font-bold text-[var(--ink-muted)]" aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
          <p className="text-[0.8125rem] font-semibold text-emerald-700 dark:text-emerald-400">All clear — nothing overdue or owed.</p>
        </div>
      )}

      {/* ── Go to ── */}
      <div className="flex flex-wrap gap-2">
        {([
          { label: "Collections", href: "/payout-followups" },
          { label: "Payables", href: "/payables" },
          { label: "Expenses", href: "/finance/expenses" },
          { label: "Invoices", href: "/documents/invoices" },
          { label: "P&L", href: "/finance/reports/pl" },
          { label: "Balance Sheet", href: "/finance/reports/balance-sheet" },
          { label: "Journal", href: "/finance/journal" },
        ] as const).map(({ label, href }) => (
          <Link key={href} href={href} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">
            {label} →
          </Link>
        ))}
      </div>

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

      {/* ── Cash flow ── */}
      {(cashFlowTotalIn > 0 || cashFlowTotalOut > 0) ? (
        <div className="dc-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">
              Cash flow · {rangeKey === "6m" ? "6 months" : rangeKey === "1y" ? "12 months" : "3 years"}
            </p>
            <div className="flex items-center gap-2">
              {([
                { label: "6M", value: "6m" },
                { label: "1Y", value: "1y" },
                { label: "3Y", value: "3y" },
              ] as const).map(({ label, value }) => (
                <Link
                  key={value}
                  href={value === "6m" ? "/finance" : `/finance?range=${value}`}
                  className={`rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold transition ${rangeKey === value ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-4 pt-2.5 text-[0.75rem] text-[var(--ink-muted)]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> In {formatMoneyCompact(cashFlowTotalIn, currency)}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> Out {formatMoneyCompact(cashFlowTotalOut, currency)}</span>
            <span className={`font-bold ${cashFlowTotalIn - cashFlowTotalOut >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              Net {cashFlowTotalIn - cashFlowTotalOut >= 0 ? "+" : "−"}{formatMoneyCompact(Math.abs(cashFlowTotalIn - cashFlowTotalOut), currency)}
            </span>
          </div>
          <div className="px-4 py-3">
            <svg viewBox="0 0 600 232" className="w-full" role="img" aria-label="Cash flow chart">
              <defs>
                <linearGradient id="cashInArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.03" />
                </linearGradient>
              </defs>
              {chTicks.map((t) => (
                <g key={t.y}>
                  <line x1={CH.L} y1={t.y} x2={CH.R} y2={t.y} stroke="var(--line)" strokeWidth="1" opacity="0.55" strokeDasharray="3 4" />
                  <text x={CH.L - 6} y={t.y + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-muted)">
                    {t.v}
                  </text>
                </g>
              ))}
              <line x1={CH.L} y1={CH.B} x2={CH.R} y2={CH.B} stroke="var(--line)" strokeWidth="1" />
              <path d={`${chInLine} L ${chX(cashFlowMonths.length - 1)} ${CH.B} L ${chX(0)} ${CH.B} Z`} fill="url(#cashInArea)" />
              <path d={chInLine} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
              <polyline
                points={chNet.map((y, i) => `${chX(i).toFixed(1)},${y.toFixed(1)}`).join(" ")}
                fill="none" stroke="var(--ink)" strokeWidth="1.25" opacity="0.45"
              />
              {cashFlowMonths.map((m, i) => {
                const barW = Math.min(22, chStep * 0.2);
                const outH = CH.B - chY(m.outflow);
                const isNow = i === cashFlowMonths.length - 1;
                return (
                  <g key={m.key}>
                    <title>{`${m.label}: in ${formatMoney(m.inflow, currency)} · out ${formatMoney(m.outflow, currency)}`}</title>
                    <rect x={chX(i) + chStep * 0.08} y={chY(m.outflow)} width={barW} height={outH} rx="3" fill="#f87171" opacity={isNow ? 0.95 : 0.6} />
                    <circle cx={chX(i)} cy={chY(m.inflow)} r={isNow ? 4 : 2.5} fill="var(--accent)" stroke="var(--panel)" strokeWidth="1.5" />
                    <circle cx={chX(i)} cy={chNet[i]} r="2.5" fill="var(--ink)" opacity={isNow ? 0.9 : 0.45} />
                    <text x={chX(i)} y={206} textAnchor="middle" fontSize="11" fontWeight={isNow ? "bold" : "normal"} fill={isNow ? "var(--ink)" : "var(--ink-muted)"}>
                      {m.label}
                    </text>
                  </g>
                );
              })}
              <text x={CH.R} y={222} textAnchor="end" fontSize="10" fill="var(--ink-muted)">● net · hover a period for exact figures</text>
            </svg>
          </div>
        </div>
      ) : null}

      {/* Module navigation now lives in the finance hub tabs (shell), so the
          redundant launcher grid was removed — the overview stays focused on
          the numbers + what needs action. */}
    </div>
  );
}
