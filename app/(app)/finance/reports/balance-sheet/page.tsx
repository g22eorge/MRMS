// @ts-nocheck — TODO: resolve underlying type issues and remove this pragma

import { StatCards } from "@/components/ui/StatCards";
import Link from "next/link";
import { PrintReportButton } from "@/components/reports/PrintReportButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/org-context";

import { prisma } from "@/lib/prisma";
import { formatMoney, formatMoneyCompact } from "@/lib/currency";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type AccountSummary = { code: string; name: string; balance: number };

function ratio(numerator: number, denominator: number, decimals = 2) {
  if (denominator === 0) return null;
  return (numerator / denominator).toFixed(decimals);
}

function AccountSection({
  title,
  items,
  total,
  currency,
  accentClass,
  badgeClass,
}: {
  title: string;
  items: AccountSummary[];
  total: number;
  currency: string;
  accentClass: string;
  badgeClass: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)]">
      <div className={`px-4 py-2.5 ${accentClass}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide">{title}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums ${badgeClass}`}>
            {formatMoneyCompact(total, currency)}
          </span>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[var(--ink-muted)]">No activity</p>
      ) : (
        <div>
          {items.map((item) => (
            <div
              key={item.code}
              className="flex items-center justify-between px-4 py-2.5 text-sm odd:bg-[var(--bg)] even:bg-[var(--panel)]/40"
            >
              <div className="flex items-center gap-1.5">
                <span className="mono text-xs text-[var(--accent)]">{item.code}</span>
                <span className="text-[var(--ink)]">{item.name}</span>
              </div>
              <span className="tabular-nums whitespace-nowrap font-medium text-[var(--ink)]">
                {formatMoney(item.balance, currency)}
              </span>
            </div>
          ))}
          <div className={`flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5 font-bold ${accentClass}`}>
            <span className="text-sm">Total {title}</span>
            <span className="text-sm tabular-nums">{formatMoney(total, currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default async function BalanceSheetPage({
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

  const asOf = new Date(year, month, 0, 23, 59, 59);

  const lines = await prisma.journalLine.findMany({
    where: { journalEntry: { orgId, status: "POSTED", date: { lte: asOf } } },
    include: { account: true },
  });

  function summarise(
    type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE",
  ): AccountSummary[] {
    const map = new Map<string, AccountSummary>();
    for (const l of lines) {
      if (l.account.type !== type) continue;
      const normalDebit = type === "ASSET" || type === "EXPENSE";
      const net = normalDebit ? l.debit - l.credit : l.credit - l.debit;
      const existing = map.get(l.accountId);
      if (existing) existing.balance += net;
      else map.set(l.accountId, { code: l.account.code, name: l.account.name, balance: net });
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  const assets = summarise("ASSET");
  const liabilities = summarise("LIABILITY");
  const equity = summarise("EQUITY");
  const revenues = summarise("REVENUE");
  const expenses = summarise("EXPENSE");

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
  const totalEquity = equity.reduce((s, e) => s + e.balance, 0);
  const retainedEarnings =
    revenues.reduce((s, r) => s + r.balance, 0) -
    expenses.reduce((s, e) => s + e.balance, 0);
  const totalEquityAndRetained = totalEquity + retainedEarnings;
  const totalLiabEquity = totalLiabilities + totalEquityAndRetained;
  const balanced = Math.abs(totalAssets - totalLiabEquity) < 0.01;

  // Financial ratios (using totals as proxy for current since we don't sub-classify)
  const workingCapital = totalAssets - totalLiabilities;
  const debtRatio = ratio(totalLiabilities, totalAssets);
  const _equityRatio = ratio(totalEquityAndRetained, totalAssets);
  const debtToEquity =
    totalEquityAndRetained !== 0
      ? ratio(totalLiabilities, Math.abs(totalEquityAndRetained))
      : null;

  const hasData = lines.length > 0;

  return (
    <div className="print-area space-y-4">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Finance · Reports"
        title="Balance Sheet"
        description={`As of ${MONTHS[month - 1]} ${year}`}
        actions={
          <>
            <PrintReportButton />
            <Link
              href={`/finance/reports/pl?year=${year}&month=${month}`}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--panel-strong)]"
            >
              ← P&amp;L
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

      {/* ── PERIOD SELECTOR ──────────────────────────────────────────────── */}
      <form method="GET" className="no-print flex items-center gap-2">
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

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-14 text-center">
          <p className="text-sm text-[var(--ink-muted)]">
            No posted accounting entries up to this date.
          </p>
        </div>
      ) : (
        <>
          {/* ── BALANCE WARNING ──────────────────────────────────────────── */}
          {!balanced && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              Balance sheet does not balance — check accounting entries for missing or incorrect lines.
            </div>
          )}

          {/* ── Financial ratios ─────────────────────────────────────────── */}
          <StatCards
            columns={4}
            cards={[
              {
                key: "assets",
                label: "Total assets",
                value: formatMoneyCompact(totalAssets, currency),
                sub: "cumulative to date",
                tone: "accent",
                muted: totalAssets === 0,
              },
              {
                key: "workingCapital",
                label: "Working capital",
                value: `${workingCapital < 0 ? "-" : ""}${formatMoneyCompact(Math.abs(workingCapital), currency)}`,
                sub: "assets − liabilities",
                tone: workingCapital >= 0 ? "good" : "crit",
                muted: workingCapital === 0,
              },
              {
                key: "debtRatio",
                label: "Debt ratio",
                value: debtRatio !== null ? debtRatio : "—",
                sub: "liabilities / assets",
                tone: Number(debtRatio ?? 0) <= 0.5 ? "good" : "warn",
                muted: debtRatio === null,
              },
              {
                key: "debtToEquity",
                label: "Debt-to-equity",
                value: debtToEquity !== null ? debtToEquity : "—",
                sub: "liabilities / equity",
                tone: Number(debtToEquity ?? 0) <= 1 ? "good" : "warn",
                muted: debtToEquity === null,
              },
            ]}
          />

          {/* ── MAIN LAYOUT: two columns on wide screens ─────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Left: Assets */}
            <AccountSection
              title="Assets"
              items={assets}
              total={totalAssets}
              currency={currency}
              accentClass="bg-blue-500/5 text-blue-700 dark:text-blue-300"
              badgeClass="bg-blue-500/15 text-blue-700 dark:text-blue-300"
            />

            {/* Right: Liabilities + Equity */}
            <div className="space-y-4">
              <AccountSection
                title="Liabilities"
                items={liabilities}
                total={totalLiabilities}
                currency={currency}
                accentClass="bg-red-500/5 text-red-700 dark:text-red-300"
                badgeClass="bg-red-500/15 text-red-700 dark:text-red-300"
              />

              {/* Equity (including retained earnings) */}
              <div className="overflow-hidden rounded-xl border border-[var(--line)]">
                <div className="bg-purple-500/5 px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                      Equity
                    </p>
                    <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[13px] font-bold tabular-nums text-purple-700 dark:text-purple-300">
                      {formatMoneyCompact(totalEquityAndRetained, currency)}
                    </span>
                  </div>
                </div>
                {equity.map((e) => (
                  <div
                    key={e.code}
                    className="flex items-center justify-between px-4 py-2.5 text-sm odd:bg-[var(--bg)] even:bg-[var(--panel)]/40"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="mono text-xs text-[var(--accent)]">{e.code}</span>
                      <span className="text-[var(--ink)]">{e.name}</span>
                    </div>
                    <span className="tabular-nums whitespace-nowrap font-medium">{formatMoney(e.balance, currency)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 text-sm odd:bg-[var(--bg)]">
                  <span className="italic text-[var(--ink-muted)]">Retained Earnings (net income)</span>
                  <span
                    className={`tabular-nums whitespace-nowrap font-medium ${retainedEarnings >= 0 ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {formatMoney(retainedEarnings, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--line)] bg-purple-500/10 px-4 py-2.5 font-bold text-purple-700 dark:text-purple-300">
                  <span className="text-sm">Total Equity</span>
                  <span className="text-sm tabular-nums">{formatMoney(totalEquityAndRetained, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── EQUATION CHECK ───────────────────────────────────────────── */}
          <div
            className={`overflow-hidden rounded-xl border px-5 py-4 ${
              balanced
                ? "border-emerald-500/30 bg-emerald-500/8"
                : "border-red-300/40 bg-red-500/10"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--ink)]">
                  Accounting Equation: Assets = Liabilities + Equity
                </p>
                <p className="text-[13px] text-[var(--ink-muted)]">
                  {formatMoney(totalAssets, currency)} ={" "}
                  {formatMoney(totalLiabilities, currency)} +{" "}
                  {formatMoney(totalEquityAndRetained, currency)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                  balanced
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-500/20 text-red-600 dark:text-red-400"
                }`}
              >
                {balanced ? "Balanced" : "Out of balance"}
              </span>
            </div>
          </div>

          {/* ── FINANCIAL RATIOS ─────────────────────────────────────────── */}
          <div>
            <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Financial Ratios</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* Current Ratio (using total assets / total liabilities as proxy) */}
              {(() => {
                const currentRatio = totalLiabilities !== 0 ? totalAssets / totalLiabilities : null;
                const color =
                  currentRatio === null ? "text-[var(--ink-muted)]"
                  : currentRatio >= 2 ? "text-emerald-600"
                  : currentRatio >= 1 ? "text-amber-600"
                  : "text-red-500";
                return (
                  <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Current Ratio</p>
                    <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>
                      {currentRatio !== null ? currentRatio.toFixed(2) : "—"}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">Assets / Liabilities (approx.)</p>
                  </div>
                );
              })()}
              {/* Debt-to-Equity */}
              {(() => {
                const dte =
                  totalEquityAndRetained !== 0
                    ? totalLiabilities / Math.abs(totalEquityAndRetained)
                    : null;
                const color =
                  dte === null ? "text-[var(--ink-muted)]"
                  : dte < 1 ? "text-emerald-600"
                  : dte < 2 ? "text-amber-600"
                  : "text-red-500";
                return (
                  <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Debt-to-Equity</p>
                    <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>
                      {dte !== null ? dte.toFixed(2) : "—"}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">Liabilities / Equity</p>
                  </div>
                );
              })()}
              {/* Working Capital */}
              <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
                <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Working Capital</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${workingCapital >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {workingCapital < 0 ? "−" : ""}{formatMoneyCompact(Math.abs(workingCapital), currency)}
                </p>
                <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">Assets − Liabilities (approx.)</p>
              </div>
            </div>
          </div>

          {/* ── QUICK LINKS ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "P&L Statement", href: `/finance/reports/pl?year=${year}&month=${month}` },
              { label: "Trial Balance", href: `/finance/reports/trial-balance?year=${year}&month=${month}` },
              { label: "Chart of Accounts", href: "/finance/accounts" },
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
