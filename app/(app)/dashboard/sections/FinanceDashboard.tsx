import Link from "next/link";

import { StatCards } from "@/components/ui/StatCards";

import { formatMoneyCompact, getAppCurrency } from "@/lib/currency";
import { monthLabel } from "@/lib/date-ranges";
import { routeLabel } from "@/lib/nav/registry";
import { prisma } from "@/lib/prisma";

import { DashboardHero } from "./shared";

import { clientDisplayName } from "@/lib/client-name";
export async function FinanceDashboard({ orgId }: { orgId: string }) {
  const currency = getAppCurrency();
  const today = new Date();
  const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const mtdLabel = monthLabel(today.getFullYear(), today.getMonth() + 1);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
  const sixtyDaysAgo  = new Date(today.getTime() - 60 * 86400000);

  const [invoices, recentPayments, salesRevenue] = await Promise.all([
    prisma.invoice.findMany({
      where: { orgId },
      select: { id: true, invoiceNumber: true, status: true, totalAmount: true, paidAmount: true, issuedAt: true, job: { select: { jobNumber: true, client: { select: { fullName: true, organization: true } } } } },
      orderBy: { issuedAt: "desc" },
      take: 50,
    }),
    prisma.payment.findMany({
      where: { orgId, createdAt: { gte: mtdStart } },
      select: { amount: true, method: true, receivedAt: true, currency: true },
      orderBy: { receivedAt: "desc" },
      take: 20,
    }),
    prisma.sale.findMany({
      where: { orgId, status: "PAID", paidAt: { gte: mtdStart } },
      select: { totalAmount: true },
    }),
  ]);

  const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalOutstanding = totalInvoiced - totalCollected;
  const overdueCount = invoices.filter(i => i.status !== "PAID" && i.issuedAt < thirtyDaysAgo).length;
  const ageingCurrent  = invoices.filter(i => i.status !== "PAID" && i.issuedAt >= thirtyDaysAgo).reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
  const ageing30to60   = invoices.filter(i => i.status !== "PAID" && i.issuedAt >= sixtyDaysAgo && i.issuedAt < thirtyDaysAgo).reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
  const ageing60plus   = invoices.filter(i => i.status !== "PAID" && i.issuedAt < sixtyDaysAgo).reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
  const posRevenueMtd  = salesRevenue.reduce((s, r) => s + r.totalAmount, 0);
  const invoiceRevenueMtd = invoices.filter(i => i.status === "PAID" && i.issuedAt >= mtdStart).reduce((s, i) => s + i.totalAmount, 0);
  const mtdPayments = recentPayments.reduce((s, p) => s + p.amount, 0);
  const methodTotals = recentPayments.reduce((acc, p) => { acc[p.method] = (acc[p.method] ?? 0) + p.amount; return acc; }, {} as Record<string, number>);
  const unpaidInvoices = invoices.filter(i => i.status !== "PAID" && i.status !== "VOID");

  return (
    <div className="space-y-4">
      <DashboardHero
        title="Finance & Accounts"
        summary={`${formatMoneyCompact(totalOutstanding, currency)} outstanding · ${overdueCount} overdue invoices · ${formatMoneyCompact(mtdPayments, currency)} collected MTD`}
        primaryHref="/documents/invoices"
        primaryLabel={routeLabel("/documents/invoices")}
        secondaryHref="/reports"
        secondaryLabel={routeLabel("/reports")}
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
      />

      {/* StatCards rather than a hand-rolled band with a `color` field. This
          reported state as the hue of a number and nothing else — "Overdue" in
          red-400 said nothing to anyone scanning, printing, or unable to see
          the hue. The shared component adds a rail and, for the two states that
          demand action, a word.

          Collected is not marked good on purpose: money already in the bank is
          the resting state of the figure, and a permanent green badge on it
          teaches the reader that the colours mean nothing. */}
      <StatCards
        columns={4}
        cards={[
          { label: "Total Invoiced", value: formatMoneyCompact(totalInvoiced, currency), href: "/documents/invoices" },
          { label: "Collected", value: formatMoneyCompact(totalCollected, currency), href: "/documents/invoices?status=PAID", sub: "paid to date" },
          {
            label: "Outstanding",
            value: formatMoneyCompact(totalOutstanding, currency),
            href: "/documents/invoices?status=ISSUED",
            tone: totalOutstanding > 0 ? "warn" : "good",
            muted: totalOutstanding === 0,
          },
          {
            label: "Overdue (30d+)",
            value: String(overdueCount),
            href: "/documents/invoices",
            sub: "past due",
            tone: overdueCount > 0 ? "crit" : "good",
            muted: overdueCount === 0,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="dc-card px-3 py-2.5">
          <p className="mb-3 text-[0.78125rem] font-bold tracking-[-0.01em] text-[var(--dc-ink)]">Invoice Ageing</p>
          <div className="space-y-2">
            {[
              { label: "Current (0–30 days)", amount: ageingCurrent, color: "bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--accent)]" },
              { label: "30–60 days",          amount: ageing30to60, color: "bg-amber-500/10 border-amber-500/25 text-amber-600" },
              { label: "60+ days (overdue)",  amount: ageing60plus, color: "bg-red-500/10 border-red-500/20 text-red-400" },
            ].map(row => (
              <div key={row.label} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${row.color}`}>
                <p className="text-xs font-medium">{row.label}</p>
                <p className="text-sm font-bold">{formatMoneyCompact(row.amount, currency)}</p>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5">
              <p className="text-xs font-semibold text-[var(--ink)]">Total Outstanding</p>
              <p className="text-sm font-black text-[var(--ink)]">{formatMoneyCompact(totalOutstanding, currency)}</p>
            </div>
          </div>
        </section>

        <section className="dc-card px-3 py-2.5">
          <p className="mb-3 text-[0.78125rem] font-bold tracking-[-0.01em] text-[var(--dc-ink)]">MTD Cash In — {mtdLabel}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5">
              <p className="text-xs text-[var(--ink-muted)]">Invoice payments</p>
              <p className="text-sm font-bold text-emerald-600">{formatMoneyCompact(invoiceRevenueMtd, currency)}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5">
              <p className="text-xs text-[var(--ink-muted)]">POS / cash sales</p>
              <p className="text-sm font-bold text-emerald-600">{formatMoneyCompact(posRevenueMtd, currency)}</p>
            </div>
            {Object.entries(methodTotals).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
                <p className="text-xs text-[var(--ink-muted)]">{method.replace(/_/g, " ")}</p>
                <p className="text-sm font-semibold text-[var(--ink)]">{formatMoneyCompact(amount, currency)}</p>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-xs font-bold text-emerald-600">Total in MTD</p>
              <p className="text-sm font-black text-emerald-600">{formatMoneyCompact(mtdPayments + posRevenueMtd, currency)}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="dc-card px-3 py-2.5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[0.78125rem] font-bold tracking-[-0.01em] text-[var(--dc-ink)]">Unpaid Invoices</p>
          <Link href="/documents/invoices" className="text-[0.8125rem] font-semibold text-[var(--accent)] hover:underline">View all →</Link>
        </div>
        {unpaidInvoices.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
            <p className="text-[0.8125rem] font-medium text-emerald-600">All invoices paid — nothing outstanding.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {unpaidInvoices.slice(0, 8).map(inv => {
              const balance = inv.totalAmount - inv.paidAmount;
              const ageDays = Math.floor((today.getTime() - inv.issuedAt.getTime()) / 86400000);
              return (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="mono truncate text-xs font-bold text-[var(--ink)]">{inv.invoiceNumber}</p>
                    <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">{clientDisplayName(inv.job?.client)} · {inv.job?.jobNumber ?? "—"}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-xs font-semibold text-[var(--accent)]">{formatMoneyCompact(balance, currency)}</p>
                    <span className={`text-[0.75rem] font-medium ${ageDays > 60 ? "text-red-400" : ageDays > 30 ? "text-amber-600" : "text-[var(--ink-muted)]"}`}>{ageDays}d</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
