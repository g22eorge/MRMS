// @ts-nocheck — TODO: resolve underlying type issues and remove this pragma

import Link from "next/link";
import { PrintReportButton } from "@/components/reports/PrintReportButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { formatMoney, formatMoneyCompact, toBaseAmount, normalizeCurrency, getAppCurrency } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { DataTable } from "@/components/ui/DataTable";

export const dynamic = "force-dynamic";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARIES: "Salaries & Wages",
  SUPPLIES: "Supplies",
  MARKETING: "Marketing",
  TRAVEL: "Travel",
  EQUIPMENT: "Equipment",
  MAINTENANCE: "Maintenance",
  TAXES: "Taxes & Levies",
  OTHER: "Other",
};

function pctChange(curr: number, prior: number): string | null {
  if (prior === 0) return curr > 0 ? "+∞" : null;
  const p = ((curr - prior) / Math.abs(prior)) * 100;
  return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { user } = await getCurrentUserRole();
  const db = orgDb(user.orgId);
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const sp = await searchParams;
  const currency = getAppCurrency();
  const BASE_CURRENCY = "UGX";
  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()));
  const month = parseInt(sp.month ?? String(now.getMonth() + 1));
  const mode = sp.mode === "ytd" ? "ytd" : "month";

  const from = mode === "ytd" ? new Date(year, 0, 1) : new Date(year, month - 1, 1);
  const to = mode === "ytd"
    ? new Date(year, month, 0, 23, 59, 59)
    : new Date(year, month, 0, 23, 59, 59);

  const priorFrom = mode === "ytd" ? new Date(year - 1, 0, 1) : new Date(year, month - 2, 1);
  const priorTo = mode === "ytd"
    ? new Date(year - 1, month, 0, 23, 59, 59)
    : new Date(year, month - 1, 0, 23, 59, 59);

  function toBase(p: { amount: number; currency: string; exchangeRateToBase?: number | null }) {
    return toBaseAmount({
      amount: p.amount,
      currency: normalizeCurrency(p.currency, BASE_CURRENCY),
      baseCurrency: BASE_CURRENCY,
      exchangeRateToBase: p.exchangeRateToBase ?? null,
    });
  }

  const [
    invoicePayments,
    salePayments,
    expenses,
    supplierPayments,
    bankCreditsAgg,
    bankDebitsAgg,
    priorInvoicePayments,
    priorSalePayments,
    priorExpenses,
    priorSupplierPayments,
    bankAccountsCount,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { orgId: user.orgId, invoiceId: { not: null }, receivedAt: { gte: from, lte: to } },
      select: { amount: true, currency: true, exchangeRateToBase: true, method: true },
    }).catch(() => []),
    prisma.payment.findMany({
      where: { orgId: user.orgId, saleId: { not: null }, receivedAt: { gte: from, lte: to } },
      select: { amount: true, currency: true, exchangeRateToBase: true, method: true },
    }).catch(() => []),
    db.expense.findMany({
      where: { paidAt: { gte: from, lte: to } },
      select: { amount: true, currency: true, exchangeRateToBase: true, category: true },
    }).catch(() => []),
    prisma.supplierPayment.findMany({
      where: { orgId: user.orgId, paidAt: { gte: from, lte: to } },
      select: { amount: true, currency: true },
    }).catch(() => []),
    prisma.bankTransaction.aggregate({
      where: { orgId: user.orgId, type: "CREDIT", date: { gte: from, lte: to } },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: null } })),
    prisma.bankTransaction.aggregate({
      where: { orgId: user.orgId, type: "DEBIT", date: { gte: from, lte: to } },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: null } })),
    prisma.payment.findMany({
      where: { orgId: user.orgId, invoiceId: { not: null }, receivedAt: { gte: priorFrom, lte: priorTo } },
      select: { amount: true, currency: true, exchangeRateToBase: true },
    }).catch(() => []),
    prisma.payment.findMany({
      where: { orgId: user.orgId, saleId: { not: null }, receivedAt: { gte: priorFrom, lte: priorTo } },
      select: { amount: true, currency: true, exchangeRateToBase: true },
    }).catch(() => []),
    db.expense.findMany({
      where: { paidAt: { gte: priorFrom, lte: priorTo } },
      select: { amount: true, currency: true, exchangeRateToBase: true },
    }).catch(() => []),
    prisma.supplierPayment.findMany({
      where: { orgId: user.orgId, paidAt: { gte: priorFrom, lte: priorTo } },
      select: { amount: true, currency: true },
    }).catch(() => []),
    db.bankAccount.count().catch(() => 0),
  ]);

  // ── Current period computations ────────────────────────────────────────────
  const invoicePaymentsTotal = invoicePayments.reduce((s, p) => s + toBase(p), 0);
  const salePaymentsTotal = salePayments.reduce((s, p) => s + toBase(p), 0);
  const totalInflow = invoicePaymentsTotal + salePaymentsTotal;

  const expensesTotal = expenses.reduce((s, e) => s + toBase(e), 0);
  const supplierPaymentsTotal = supplierPayments.reduce((s, p) => s + p.amount, 0);
  const totalOutflow = expensesTotal + supplierPaymentsTotal;

  const netOperating = totalInflow - totalOutflow;
  const operatingMarginPct = totalInflow > 0 ? Math.round((netOperating / totalInflow) * 100) : 0;

  const bankCreditTotal = bankCreditsAgg._sum.amount ?? 0;
  const bankDebitTotal = bankDebitsAgg._sum.amount ?? 0;
  const netBank = bankCreditTotal - bankDebitTotal;

  // ── Prior period ────────────────────────────────────────────────────────────
  const priorInflow = [...priorInvoicePayments, ...priorSalePayments].reduce((s, p) => s + toBase(p), 0);
  const priorOutflow = priorExpenses.reduce((s, e) => s + toBase(e), 0) + priorSupplierPayments.reduce((s, p) => s + p.amount, 0);
  const priorNet = priorInflow - priorOutflow;

  // ── Expense breakdown by category ──────────────────────────────────────────
  const expenseByCategory = expenses.reduce((acc, e) => {
    const cat = (e as { category: string }).category;
    acc[cat] = (acc[cat] ?? 0) + toBase(e);
    return acc;
  }, {} as Record<string, number>);
  const topExpenseCategories = Object.entries(expenseByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  // ── Period label ────────────────────────────────────────────────────────────
  const periodLabel = mode === "ytd"
    ? `YTD ${year} (Jan–${MONTHS_SHORT[month - 1]})`
    : `${MONTHS_SHORT[month - 1]} ${year}`;
  const priorLabel = mode === "ytd"
    ? `YTD ${year - 1}`
    : `${MONTHS_SHORT[month === 1 ? 11 : month - 2]} ${month === 1 ? year - 1 : year}`;

  // Year / month selector arrays
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const monthOptions = MONTHS_SHORT.map((m, i) => ({ label: m, value: i + 1 }));

  // ── Statement rows (for DataTable) ─────────────────────────────────────────
  const priorInvoiceTotal = priorInvoicePayments.reduce((s, p) => s + toBase(p), 0);
  const priorSaleTotal = priorSalePayments.reduce((s, p) => s + toBase(p), 0);
  const priorExpensesTotal = priorExpenses.reduce((s, e) => s + toBase(e), 0);
  const priorSupplierTotal = priorSupplierPayments.reduce((s, p) => s + p.amount, 0);

  const changeCell = (c: string | null, good: boolean) =>
    c ? (
      <span className={good ? "text-emerald-600" : "text-red-500"}>{c}</span>
    ) : (
      <span className="text-[var(--ink-muted)]">—</span>
    );

  const statementRows = [
    {
      id: "invoice-receipts",
      section: "Operating Activities",
      label: <span className="block pl-4 text-sm text-[var(--ink)]">Repair invoice receipts</span>,
      current: <span className="font-semibold tabular-nums text-emerald-700">{formatMoney(invoicePaymentsTotal, currency)}</span>,
      prior: <span className="tabular-nums text-[var(--ink-muted)]">{formatMoney(priorInvoiceTotal, currency)}</span>,
      change: (
        <span className="text-[13px]">
          {changeCell(pctChange(invoicePaymentsTotal, priorInvoiceTotal), invoicePaymentsTotal >= priorInvoiceTotal)}
        </span>
      ),
    },
    {
      id: "sale-receipts",
      label: <span className="block pl-4 text-sm text-[var(--ink)]">POS / sale receipts</span>,
      current: <span className="font-semibold tabular-nums text-emerald-700">{formatMoney(salePaymentsTotal, currency)}</span>,
      prior: <span className="tabular-nums text-[var(--ink-muted)]">{formatMoney(priorSaleTotal, currency)}</span>,
      change: (
        <span className="text-[13px]">
          {changeCell(pctChange(salePaymentsTotal, priorSaleTotal), salePaymentsTotal >= priorSaleTotal)}
        </span>
      ),
    },
    {
      id: "total-inflows",
      className: "border-t border-[var(--line)] bg-emerald-50/30 font-medium hover:bg-emerald-50/50",
      label: <span className="block pl-2 text-sm font-semibold text-[var(--ink)]">Total Cash Inflows</span>,
      current: <span className="font-bold tabular-nums text-emerald-700">{formatMoney(totalInflow, currency)}</span>,
      prior: <span className="font-semibold tabular-nums text-[var(--ink-muted)]">{formatMoney(priorInflow, currency)}</span>,
      change: (
        <span className="text-[13px] font-semibold">
          {changeCell(pctChange(totalInflow, priorInflow), totalInflow >= priorInflow)}
        </span>
      ),
    },
    {
      id: "expenses-paid",
      label: <span className="block pl-4 text-sm text-[var(--ink)]">Operating expenses paid</span>,
      current: <span className="font-semibold tabular-nums text-red-600">({formatMoney(expensesTotal, currency)})</span>,
      prior: <span className="tabular-nums text-[var(--ink-muted)]">({formatMoney(priorExpensesTotal, currency)})</span>,
      change: (
        <span className="text-[13px]">
          {changeCell(pctChange(expensesTotal, priorExpensesTotal), expensesTotal <= priorExpensesTotal)}
        </span>
      ),
    },
    {
      id: "supplier-payments",
      label: <span className="block pl-4 text-sm text-[var(--ink)]">Supplier payments</span>,
      current: <span className="font-semibold tabular-nums text-red-600">({formatMoney(supplierPaymentsTotal, currency)})</span>,
      prior: <span className="tabular-nums text-[var(--ink-muted)]">({formatMoney(priorSupplierTotal, currency)})</span>,
      change: <span className="text-[13px]">—</span>,
    },
    {
      id: "total-outflows",
      className: "border-t border-[var(--line)] bg-red-500/5 font-medium hover:bg-red-500/10",
      label: <span className="block pl-2 text-sm font-semibold text-[var(--ink)]">Total Cash Outflows</span>,
      current: <span className="font-bold tabular-nums text-red-600">({formatMoney(totalOutflow, currency)})</span>,
      prior: <span className="font-semibold tabular-nums text-[var(--ink-muted)]">({formatMoney(priorOutflow, currency)})</span>,
      change: (
        <span className="text-[13px] font-semibold">
          {changeCell(pctChange(totalOutflow, priorOutflow), totalOutflow <= priorOutflow)}
        </span>
      ),
    },
    {
      id: "net-operating",
      className: `border-t-2 border-[var(--line)] ${netOperating >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`,
      label: <span className="block text-sm font-bold text-[var(--ink)]">Net Operating Cash Flow</span>,
      current: (
        <span className={`text-base font-bold tabular-nums ${netOperating >= 0 ? "text-emerald-700" : "text-red-600"}`}>
          {netOperating >= 0 ? "+" : ""}{formatMoney(netOperating, currency)}
        </span>
      ),
      prior: (
        <span className="font-semibold tabular-nums text-[var(--ink-muted)]">
          {priorNet >= 0 ? "+" : ""}{formatMoney(priorNet, currency)}
        </span>
      ),
      change: (
        <span className="text-[13px] font-bold">
          {changeCell(pctChange(netOperating, priorNet), netOperating >= priorNet)}
        </span>
      ),
    },
    ...(bankAccountsCount > 0
      ? [
          {
            id: "bank-credits",
            section: "Bank Activity (Reconciliation Reference)",
            label: <span className="block pl-4 text-sm text-[var(--ink)]">Bank deposits / credits</span>,
            current: <span className="font-semibold tabular-nums text-emerald-700">{formatMoney(bankCreditTotal, currency)}</span>,
            prior: <span className="text-[var(--ink-muted)]">—</span>,
            change: <span>—</span>,
          },
          {
            id: "bank-debits",
            label: <span className="block pl-4 text-sm text-[var(--ink)]">Bank withdrawals / debits</span>,
            current: <span className="font-semibold tabular-nums text-red-600">({formatMoney(bankDebitTotal, currency)})</span>,
            prior: <span className="text-[var(--ink-muted)]">—</span>,
            change: <span>—</span>,
          },
          {
            id: "net-bank",
            className: "border-t border-[var(--line)] bg-sky-50/30 font-medium",
            label: <span className="block pl-2 text-sm font-semibold text-[var(--ink)]">Net Bank Movement</span>,
            current: (
              <span className={`font-bold tabular-nums ${netBank >= 0 ? "text-emerald-700" : "text-amber-600"}`}>
                {netBank >= 0 ? "+" : ""}{formatMoney(netBank, currency)}
              </span>
            ),
            prior: null,
            change: null,
          },
        ]
      : []),
  ];

  return (
    <div className="print-area space-y-4">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Finance · Reports"
        title="Cash Flow Statement"
        description={periodLabel}
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <PrintReportButton />
            <Link href="/finance/reports" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs">← Reports</Link>
            <form className="flex flex-wrap gap-1.5" method="GET">
              <select name="mode" defaultValue={mode} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none">
                <option value="month">Monthly</option>
                <option value="ytd">YTD</option>
              </select>
              <select name="month" defaultValue={month} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none">
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select name="year" defaultValue={year} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none">
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button type="submit" className="btn-premium rounded-lg px-3 py-1.5 text-xs font-semibold">Apply</button>
            </form>
          </div>
        }
      />

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Cash Inflow</p>
          <p className="mt-1 text-lg font-bold text-emerald-600">{formatMoneyCompact(totalInflow, currency)}</p>
          <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
            {pctChange(totalInflow, priorInflow) ? (
              <span className={totalInflow >= priorInflow ? "text-emerald-600" : "text-red-500"}>{pctChange(totalInflow, priorInflow)} vs {priorLabel}</span>
            ) : "No prior data"}
          </p>
        </div>
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Cash Outflow</p>
          <p className="mt-1 text-lg font-bold text-red-500">{formatMoneyCompact(totalOutflow, currency)}</p>
          <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
            {pctChange(totalOutflow, priorOutflow) ? (
              <span className={totalOutflow <= priorOutflow ? "text-emerald-600" : "text-red-500"}>{pctChange(totalOutflow, priorOutflow)} vs {priorLabel}</span>
            ) : "No prior data"}
          </p>
        </div>
        <div className={`panel-shadow rounded-xl border px-4 py-3 ${netOperating >= 0 ? "border-emerald-400/30 bg-emerald-500/10" : "border-red-400/30 bg-red-500/10"}`}>
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Net Cash Flow</p>
          <p className={`mt-1 text-lg font-bold ${netOperating >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {netOperating >= 0 ? "+" : ""}{formatMoneyCompact(netOperating, currency)}
          </p>
          <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{operatingMarginPct}% operating margin</p>
        </div>
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Net Bank Activity</p>
          <p className={`mt-1 text-lg font-bold ${netBank >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
            {netBank >= 0 ? "+" : ""}{formatMoneyCompact(netBank, currency)}
          </p>
          <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{bankAccountsCount} bank account{bankAccountsCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* ── Statement Table ────────────────────────────────────────────────── */}
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] bg-[var(--panel-strong)]/60 px-4 py-2.5">
          <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
            Statement of Cash Flows — {periodLabel}
          </p>
        </div>
        <div className="doc-list">
          <DataTable
            frameless
            dense
            rows={statementRows}
            getRowKey={(row) => row.id}
            renderSectionRow={(row) => row.section ?? null}
            rowClassName={(row) => row.className}
            columns={[
              {
                key: "lineItem",
                header: "Line Item",
                cell: (row) => row.label,
              },
              {
                key: "current",
                header: periodLabel,
                align: "right",
                cell: (row) => row.current,
              },
              {
                key: "prior",
                header: priorLabel,
                align: "right",
                headerClassName: "hidden md:table-cell",
                className: "hidden md:table-cell",
                cell: (row) => row.prior,
              },
              {
                key: "change",
                header: "Change",
                align: "right",
                headerClassName: "hidden md:table-cell",
                className: "hidden md:table-cell",
                cell: (row) => row.change,
              },
            ]}
          />
        </div>
      </div>

      {/* ── Expense Breakdown ─────────────────────────────────────────────── */}
      {topExpenseCategories.length > 0 && (
        <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] bg-[var(--panel-strong)]/60 px-4 py-2.5">
            <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Expense Breakdown — {periodLabel}</p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {topExpenseCategories.map(([cat, amount]) => {
              return (
                <div key={cat} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-[130px] shrink-0 text-xs font-medium text-[var(--ink)]">
                    {EXPENSE_CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <span className="flex-1" />
                  <span className="w-[90px] shrink-0 text-right text-[13px] font-semibold tabular-nums text-[var(--ink)]">
                    {formatMoney(amount, currency)}
                  </span>
                  <span className="w-[36px] shrink-0 text-right text-[12px] text-[var(--ink-muted)]">
                    {totalOutflow > 0 ? Math.round((amount / totalOutflow) * 100) : 0}%
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-[var(--line)] px-4 py-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--ink)]">Total Expenses</span>
              <span className="font-bold tabular-nums text-red-600">{formatMoney(expensesTotal, currency)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary callout ───────────────────────────────────────────────── */}
      <div className={`panel-shadow rounded-xl border px-4 py-3 ${netOperating >= 0 ? "border-emerald-400/30 bg-emerald-500/10" : "border-red-400/30 bg-red-500/10"}`}>
        <p className="text-xs font-semibold text-[var(--ink)]">
          {netOperating >= 0
            ? `Cash positive: ${formatMoney(netOperating, currency)} more came in than went out during ${periodLabel}.`
            : `Cash deficit: ${formatMoney(Math.abs(netOperating), currency)} more was spent than received during ${periodLabel}. Review outflows.`}
        </p>
        {priorNet !== 0 && (
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
            Prior period ({priorLabel}) net: {priorNet >= 0 ? "+" : ""}{formatMoney(priorNet, currency)}
          </p>
        )}
      </div>
    </div>
  );
}
