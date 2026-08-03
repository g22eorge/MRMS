// @ts-nocheck — TODO: resolve underlying type issues and remove this pragma
import { StatCards } from "@/components/ui/StatCards";
import Link from "next/link";
import { PrintReportButton } from "@/components/reports/PrintReportButton";
import { PageHeader } from "@/components/ui/PageHeader";
// @ts-nocheck
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/org-context";

import { prisma } from "@/lib/prisma";
import { formatMoney, formatMoneyCompact } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { PLTrendChart } from "@/components/reports/FinanceCharts";
import { DataTable } from "@/components/ui/DataTable";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pctOfRevenue(amount: number, revenue: number) {
  if (revenue <= 0) return null;
  return ((amount / revenue) * 100).toFixed(1);
}

function changePct(current: number, prior: number) {
  if (prior === 0) return current > 0 ? "+∞" : null;
  const p = ((current - prior) / Math.abs(prior)) * 100;
  return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
}

export default async function PLPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { user, orgId, org } = await requireOrgSession();
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const sp = await searchParams;
  const currency = org.baseCurrency;
  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()));
  const month = parseInt(sp.month ?? String(now.getMonth() + 1));
  const mode = sp.mode === "ytd" ? "ytd" : "month";

  // Current period
  const from = mode === "ytd" ? new Date(year, 0, 1) : new Date(year, month - 1, 1);
  const to = mode === "ytd"
    ? new Date(year, month, 0, 23, 59, 59)
    : new Date(year, month, 0, 23, 59, 59);

  // Prior period (same length, shifted back by one period)
  const priorFrom = mode === "ytd"
    ? new Date(year - 1, 0, 1)
    : new Date(year, month - 2, 1);
  const priorTo = mode === "ytd"
    ? new Date(year - 1, month, 0, 23, 59, 59)
    : new Date(year, month - 1, 0, 23, 59, 59);

  // 6-month trend window (ending at selected month)
  const trendWindowStart = new Date(year, month - 7, 1);
  const trendWindowEnd = new Date(year, month, 0, 23, 59, 59);

  const [lines, priorLines, trendLines] = await Promise.all([
    prisma.journalLine.findMany({
      where: { journalEntry: { orgId, status: "POSTED", date: { gte: from, lte: to } } },
      include: { account: true, journalEntry: { select: { date: true } } },
    }),
    prisma.journalLine.findMany({
      where: { journalEntry: { orgId, status: "POSTED", date: { gte: priorFrom, lte: priorTo } } },
      include: { account: true },
    }),
    prisma.journalLine.findMany({
      where: {
        journalEntry: {
          orgId,
          status: "POSTED",
          date: { gte: trendWindowStart, lte: trendWindowEnd },
        },
      },
      include: { account: true, journalEntry: { select: { date: true } } },
    }),
  ]);

  type AccountRow = {
    code: string;
    name: string;
    amount: number;
    priorAmount: number;
  };

  function buildRows(type: "REVENUE" | "EXPENSE"): AccountRow[] {
    const map = new Map<string, AccountRow>();

    for (const l of lines) {
      if (l.account.type !== type) continue;
      const net = type === "REVENUE" ? l.credit - l.debit : l.debit - l.credit;
      const row = map.get(l.accountId);
      if (row) row.amount += net;
      else map.set(l.accountId, { code: l.account.code, name: l.account.name, amount: net, priorAmount: 0 });
    }
    for (const l of priorLines) {
      if (l.account.type !== type) continue;
      const net = type === "REVENUE" ? l.credit - l.debit : l.debit - l.credit;
      const row = map.get(l.accountId);
      if (row) row.priorAmount += net;
      else map.set(l.accountId, { code: l.account.code, name: l.account.name, amount: 0, priorAmount: net });
    }

    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  const revenues = buildRows("REVENUE");
  const expenses = buildRows("EXPENSE");

  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const netIncome = totalRevenue - totalExpense;
  const priorRevenue = revenues.reduce((s, r) => s + r.priorAmount, 0);
  const priorExpense = expenses.reduce((s, e) => s + e.priorAmount, 0);
  const priorNetIncome = priorRevenue - priorExpense;
  const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
  const priorNetMargin = priorRevenue > 0 ? (priorNetIncome / priorRevenue) * 100 : 0;

  // Build 6-month trend data
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1);
    return {
      key: `${MONTHS_SHORT[d.getMonth()]}${d.getFullYear() !== year ? " '" + String(d.getFullYear()).slice(2) : ""}`,
      yr: d.getFullYear(),
      mo: d.getMonth(),
    };
  });

  const trendMap = new Map(trendMonths.map((m) => [m.key, { key: m.key, revenue: 0, expenses: 0, net: 0 }]));

  for (const l of trendLines) {
    if (!l.journalEntry) continue;
    const d = l.journalEntry.date;
    const entry = trendMonths.find((m) => m.yr === d.getFullYear() && m.mo === d.getMonth());
    if (!entry) continue;
    const bucket = trendMap.get(entry.key);
    if (!bucket) continue;
    if (l.account.type === "REVENUE") bucket.revenue += l.credit - l.debit;
    if (l.account.type === "EXPENSE") bucket.expenses += l.debit - l.credit;
    bucket.net = bucket.revenue - bucket.expenses;
  }
  const trendData = [...trendMap.values()];

  const hasData = lines.length > 0;
  const hasTrend = trendLines.length > 0;

  const periodLabel = mode === "ytd"
    ? `Jan–${MONTHS[month - 1]} ${year} YTD`
    : `${MONTHS[month - 1]} ${year}`;
  const priorLabel = mode === "ytd"
    ? `Jan–${MONTHS[month - 1]} ${year - 1}`
    : month === 1
      ? `${MONTHS[11]} ${year - 1}`
      : `${MONTHS[month - 2]} ${year}`;

  return (
    <div className="print-area space-y-4">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Finance"
        title="Profit & Loss"
        description={periodLabel}
        actions={
          <>
            <PrintReportButton />
            <Link
              href={`/finance/reports/balance-sheet?year=${year}&month=${month}`}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--panel-strong)]"
            >
              Balance Sheet →
            </Link>
            <Link
              href={`/finance/reports/trial-balance?year=${year}&month=${month}`}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--panel-strong)]"
            >
              Trial Balance
            </Link>
            <Link
              href="/finance/accounts"
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--panel-strong)]"
            >
              Chart of Accounts
            </Link>
          </>
        }
      />

      {/* ── BOTTOM LINE SUMMARY ─────────────────────────────────────────── */}
      {hasData && (
        <div className={`rounded-xl border px-5 py-4 ${netIncome >= 0 ? "border-emerald-500/30 bg-emerald-500/8" : "border-red-500/30 bg-red-500/8"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Bottom Line — {periodLabel}</p>
              <p className={`mt-1 text-[28px] font-black leading-none tabular-nums ${netIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {netIncome < 0 ? "−" : ""}{formatMoney(Math.abs(netIncome), currency)}
              </p>
              <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
                Net margin {netMargin.toFixed(1)}%
                {priorNetIncome !== 0 && <span className={`ml-2 font-semibold ${netIncome >= priorNetIncome ? "text-emerald-500" : "text-red-400"}`}>
                  {changePct(netIncome, priorNetIncome)} vs {priorLabel}
                </span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">Revenue</p>
                <p className="text-[17px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoneyCompact(totalRevenue, currency)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">Expenses</p>
                <p className="text-[17px] font-black tabular-nums text-rose-500">{formatMoneyCompact(totalExpense, currency)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PERIOD SELECTOR ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <form method="GET" className="no-print flex items-center gap-2">
          <input type="hidden" name="mode" value={mode} />
          <select
            name="month"
            defaultValue={month}
            className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px]"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            name="year"
            defaultValue={year}
            className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px]"
          >
            {[year - 2, year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black"
          >
            View
          </button>
        </form>

        {/* Monthly / YTD toggle */}
        <div className="flex rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-0.5">
          <Link
            href={`/finance/reports/pl?year=${year}&month=${month}&mode=month`}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              mode === "month"
                ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            Monthly
          </Link>
          <Link
            href={`/finance/reports/pl?year=${year}&month=${month}&mode=ytd`}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              mode === "ytd"
                ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            YTD
          </Link>
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      {hasData && (
        <StatCards
          columns={4}
          cards={[
            {
              key: "revenue",
              label: "Revenue",
              value: formatMoneyCompact(totalRevenue, currency),
              sub: priorRevenue > 0 ? `${changePct(totalRevenue, priorRevenue)} vs ${priorLabel}` : undefined,
              tone: "good",
              muted: totalRevenue === 0,
            },
            {
              key: "expenses",
              label: "Expenses",
              value: formatMoneyCompact(totalExpense, currency),
              sub: priorExpense > 0 ? `${changePct(totalExpense, priorExpense)} vs ${priorLabel}` : undefined,
              tone: "crit",
              muted: totalExpense === 0,
            },
            {
              key: "net",
              label: `Net ${netIncome >= 0 ? "income" : "loss"}`,
              value: formatMoneyCompact(Math.abs(netIncome), currency),
              sub: priorNetIncome !== 0 ? `${changePct(netIncome, priorNetIncome)} vs prior` : undefined,
              tone: netIncome >= 0 ? "good" : "crit",
              muted: netIncome === 0,
            },
            {
              key: "margin",
              label: "Net margin",
              value: `${netMargin.toFixed(1)}%`,
              sub: `prior: ${priorRevenue > 0 ? priorNetMargin.toFixed(1) + "%" : "—"}`,
              tone: netMargin >= 0 ? "good" : "crit",
              muted: netMargin === 0,
            },
          ]}
        />
      )}

      {/* ── EMPTY STATE ──────────────────────────────────────────────────── */}
      {!hasData ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-14 text-center space-y-2">
          <p className="text-sm font-medium text-[var(--ink-muted)]">
            No posted accounting entries for this period.
          </p>
        </div>
      ) : (
        <>
          {/* ── P&L TABLE ──────────────────────────────────────────────────── */}
          <DataTable
            dense
            rows={[
              ...(revenues.length === 0
                ? [{ id: "rev-empty", kind: "empty", section: "REVENUE", label: "No revenue accounts with activity" }]
                : revenues.map((r) => ({ id: `rev-${r.code}`, kind: "account", section: "REVENUE", ...r }))),
              { id: "rev-total", kind: "total", section: "REVENUE", label: "Total Revenue", amount: totalRevenue, priorAmount: priorRevenue },
              ...(expenses.length === 0
                ? [{ id: "exp-empty", kind: "empty", section: "EXPENSE", label: "No expense accounts with activity" }]
                : expenses.map((e) => ({ id: `exp-${e.code}`, kind: "account", section: "EXPENSE", ...e }))),
              { id: "exp-total", kind: "total", section: "EXPENSE", label: "Total Expenses", amount: totalExpense, priorAmount: priorExpense },
            ]}
            getRowKey={(row) => row.id}
            renderSectionRow={(row, i) => {
              if (i === 0)
                return <span className="text-emerald-700 dark:text-emerald-300">Revenue</span>;
              if (row.section === "EXPENSE" && (row.id === "exp-empty" || row.id === `exp-${expenses[0]?.code}`))
                return <span className="text-red-700">Expenses</span>;
              return null;
            }}
            rowClassName={(row) =>
              row.kind === "total"
                ? row.section === "REVENUE"
                  ? "bg-green-500/10"
                  : "bg-red-500/10"
                : undefined
            }
            columns={[
              {
                key: "account",
                header: "Account",
                cell: (row) => {
                  if (row.kind === "empty")
                    return <span className="text-[var(--ink-muted)]">{row.label}</span>;
                  if (row.kind === "total")
                    return (
                      <span
                        className={`text-sm font-bold ${
                          row.section === "REVENUE"
                            ? "text-emerald-800 dark:text-emerald-200"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {row.label}
                      </span>
                    );
                  const pct = row.section === "EXPENSE" ? pctOfRevenue(row.amount, totalRevenue) : null;
                  return (
                    <span className="flex items-center gap-1.5">
                      <span className="mono text-[var(--accent)]">{row.code}</span>
                      <span className="text-[var(--ink)]">{row.name}</span>
                      {pct !== null && (
                        <span className="rounded-full bg-[var(--panel-strong)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--ink-muted)]">
                          {pct}%
                        </span>
                      )}
                    </span>
                  );
                },
              },
              {
                key: "current",
                header: periodLabel,
                align: "right",
                className: "w-28 whitespace-nowrap",
                cell: (row) => {
                  if (row.kind === "empty") return null;
                  if (row.kind === "total")
                    return (
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          row.section === "REVENUE"
                            ? "text-emerald-800 dark:text-emerald-200"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {formatMoney(row.amount, currency)}
                      </span>
                    );
                  return <span className="font-medium tabular-nums">{formatMoney(row.amount, currency)}</span>;
                },
              },
              {
                key: "prior",
                header: priorLabel,
                align: "right",
                className: "w-28 whitespace-nowrap",
                cell: (row) => {
                  if (row.kind === "empty") return null;
                  if (row.kind === "total")
                    return (
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          row.section === "REVENUE"
                            ? "text-emerald-700 dark:text-emerald-300/70"
                            : "text-red-700/70"
                        }`}
                      >
                        {formatMoney(row.priorAmount, currency)}
                      </span>
                    );
                  return (
                    <span className="tabular-nums text-[var(--ink-muted)]">
                      {formatMoney(row.priorAmount, currency)}
                    </span>
                  );
                },
              },
              {
                key: "change",
                header: "Change",
                align: "right",
                className: "w-16 whitespace-nowrap",
                cell: (row) => {
                  if (row.kind === "empty") return null;
                  const improved =
                    row.section === "REVENUE" ? row.amount >= row.priorAmount : row.amount <= row.priorAmount;
                  return (
                    <span
                      className={`font-semibold tabular-nums ${improved ?"text-emerald-600" : "text-red-500"}`}
                    >
                      {changePct(row.amount, row.priorAmount) ?? "—"}
                    </span>
                  );
                },
              },
            ]}
            tableFooter={
              <tr className={netIncome >= 0 ? "bg-green-500/15" : "bg-red-500/15"}>
                <td className="px-3 py-4">
                  <span className="text-base font-bold text-[var(--ink)]">
                    Net {netIncome >= 0 ? "Income" : "Loss"}
                  </span>
                  {totalRevenue > 0 && (
                    <span
                      className={`ml-2 text-[13px] font-semibold ${
                        netMargin >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      ({netMargin.toFixed(1)}% margin)
                    </span>
                  )}
                </td>
                <td
                  className={`px-3 py-4 text-right text-lg font-bold tabular-nums ${
                    netIncome >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700"
                  }`}
                >
                  {formatMoney(Math.abs(netIncome), currency)}
                </td>
                <td
                  className={`px-3 py-4 text-right text-sm font-semibold tabular-nums ${
                    priorNetIncome >= 0 ? "text-emerald-700 dark:text-emerald-300/60" : "text-red-700/60"
                  }`}
                >
                  {formatMoney(Math.abs(priorNetIncome), currency)}
                </td>
                <td
                  className={`px-3 py-4 text-right text-[13px] font-semibold tabular-nums ${
                    netIncome >= priorNetIncome ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {changePct(netIncome, priorNetIncome) ?? "—"}
                </td>
              </tr>
            }
          />

          {/* ── 6-MONTH TREND ────────────────────────────────────────────────── */}
          {hasTrend && (
            <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                  6-Month Trend
                </p>
                <p className="text-[13px] text-[var(--ink-muted)]">Revenue · Expenses · Net</p>
              </div>
              <PLTrendChart data={trendData} currency={currency} />
              <div className="mt-4 doc-list">
                <DataTable
                  frameless
                  dense
                  rows={trendData}
                  getRowKey={(row) => row.key}
                  columns={[
                    {
                      key: "month",
                      header: "Month",
                      className: "font-medium text-[var(--ink)]",
                      cell: (row) => row.key,
                    },
                    {
                      key: "revenue",
                      header: "Revenue",
                      align: "right",
                      className: "tabular-nums text-emerald-600",
                      cell: (row) => formatMoneyCompact(row.revenue, currency),
                    },
                    {
                      key: "expenses",
                      header: "Expenses",
                      align: "right",
                      className: "tabular-nums text-[var(--ink-muted)]",
                      cell: (row) => formatMoneyCompact(row.expenses, currency),
                    },
                    {
                      key: "net",
                      header: "Net",
                      align: "right",
                      cell: (row) => (
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            row.net >= 0 ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {row.net < 0 ? "−" : ""}
                          {formatMoneyCompact(Math.abs(row.net), currency)}
                        </span>
                      ),
                    },
                    {
                      key: "margin",
                      header: "Margin",
                      align: "right",
                      cell: (row) => (
                        <span
                          className={`text-[13px] tabular-nums ${
                            row.revenue > 0 && row.net / row.revenue >= 0 ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {row.revenue > 0 ? ((row.net / row.revenue) * 100).toFixed(1) + "%" : "—"}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            </section>
          )}

          {/* ── QUICK LINKS ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Balance Sheet", href: `/finance/reports/balance-sheet?year=${year}&month=${month}` },
              { label: "Expenses", href: "/finance/expenses" },
              { label: "Bank Accounts", href: "/finance/bank" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-center text-sm font-medium text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
