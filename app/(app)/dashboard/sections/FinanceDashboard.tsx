import Link from "next/link";

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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Total Invoiced", val: formatMoneyCompact(totalInvoiced, currency), href: "/documents/invoices", color: "text-[var(--ink)]" },
          { label: "Collected",      val: formatMoneyCompact(totalCollected, currency), href: "/documents/invoices?status=PAID", color: "text-emerald-600" },
          { label: "Outstanding",    val: formatMoneyCompact(totalOutstanding, currency), href: "/documents/invoices?status=ISSUED", color: totalOutstanding > 0 ? "text-[var(--accent)]" : "text-emerald-600" },
          { label: "Overdue (30d+)", val: String(overdueCount), href: "/documents/invoices", color: overdueCount > 0 ? "text-red-400" : "text-[var(--ink-muted)]" },
        ].map(t => (
          <Link key={t.label} href={t.href} className="dc-card px-3 py-2.5 transition hover:-translate-y-[2px]">
            <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">{t.label}</p>
            <p className={`mt-1 text-[0.9375rem] font-black leading-tight ${t.color}`}>{t.val}</p>
          </Link>
        ))}
      </div>

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
