import Link from "next/link";

import { StickyKpiRow } from "@/components/mobile/StickyKpiRow";
import { formatMoney, getAppCurrency } from "@/lib/currency";
import { monthRange } from "@/lib/date-ranges";
import { routeLabel } from "@/lib/nav/registry";
import { prisma } from "@/lib/prisma";

import { DashboardHero } from "./shared";

export async function SalesManagerDashboard({ orgId }: { orgId: string | null }) {
  const currency = getAppCurrency();
  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthRange(now.getFullYear(), now.getMonth() + 1);
  const orgFilter = orgId ? { orgId } : {};

  const [leadsOpen, leadsWon, quotationsPending, salesThisMonthAgg] = await Promise.all([
    prisma.lead.count({
      where: { ...orgFilter, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT"] } },
    }).catch(() => 0),
    prisma.lead.count({ where: { ...orgFilter, status: "WON" } }).catch(() => 0),
    prisma.quotation.count({
      where: { ...orgFilter, status: { in: ["DRAFT", "SENT"] } },
    }).catch(() => 0),
    prisma.sale.aggregate({
      _sum: { totalAmount: true },
      where: {
        ...orgFilter,
        status: "PAID",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    }).catch(() => ({ _sum: { totalAmount: null } })),
  ]);

  const salesThisMonth = salesThisMonthAgg._sum.totalAmount ?? 0;

  return (
    <div className="space-y-4">
      <DashboardHero
        title="Sales Command Centre"
        summary="Monitor leads pipeline, track quotations, and review revenue against targets."
        primaryHref="/sales"
        primaryLabel={routeLabel("/sales")}
        secondaryHref="/targets"
        secondaryLabel={routeLabel("/targets")}
      />

      <StickyKpiRow
        items={[
          { label: "Open Leads", value: String(leadsOpen), href: "/sales", tone: "brand" },
          { label: "Won", value: String(leadsWon), href: "/sales?tab=leads&status=WON", tone: "success" },
          { label: "Quotes Pending", value: String(quotationsPending), href: "/sales?tab=quotations", tone: "warning" },
          { label: "Revenue", value: formatMoney(salesThisMonth, currency), href: "/reports" },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Link href="/sales" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Open Leads</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{leadsOpen}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">View pipeline →</p>
        </Link>
        <Link href="/sales?tab=leads&status=WON" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Won Leads</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{leadsWon}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">View won leads →</p>
        </Link>
        <Link href="/sales?tab=quotations" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Quotations Pending</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{quotationsPending}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">Review quotations →</p>
        </Link>
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Revenue This Month</p>
          <p className="mt-1 text-xl font-semibold text-[var(--ink)]">{formatMoney(salesThisMonth, currency)}</p>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">Paid sales</p>
        </div>
      </div>
    </div>
  );
}

export async function SalesCorporateDashboard({ userId, orgId }: { userId: string; orgId: string | null }) {
  const orgFilter = orgId ? { orgId } : {};
  const myLeadAccess = { OR: [{ assignedToId: userId }, { createdById: userId }] };
  const [myQuotationsDraft, myQuotationsSent, myLeads, openInvoices] = await Promise.all([
    prisma.quotation.count({
      where: { ...orgFilter, createdById: userId, status: "DRAFT" },
    }).catch(() => 0),
    prisma.quotation.count({
      where: { ...orgFilter, createdById: userId, status: "SENT" },
    }).catch(() => 0),
    prisma.lead.count({
      where: {
        ...orgFilter,
        ...myLeadAccess,
        status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT"] },
      },
    }).catch(() => 0),
    prisma.invoice.count({
      where: { ...orgFilter, status: { in: ["DRAFT", "ISSUED"] } },
    }).catch(() => 0),
  ]);

  return (
    <div className="space-y-4">
      <DashboardHero
        title="Corporate Sales"
        summary="Manage your corporate accounts, track quotation approvals, and keep leads progressing."
        primaryHref="/sales"
        primaryLabel={routeLabel("/sales")}
        secondaryHref="/sales/quotations/new"
        secondaryLabel="New Quotation"
      />

      <StickyKpiRow
        items={[
          { label: "Draft Quotes", value: String(myQuotationsDraft), href: "/sales?tab=quotations", tone: "warning" },
          { label: "Sent Quotes", value: String(myQuotationsSent), href: "/sales?tab=quotations", tone: "brand" },
          { label: "My Leads", value: String(myLeads), href: "/sales", tone: "success" },
          { label: "Open Invoices", value: String(openInvoices), href: "/documents/invoices", tone: "warning" },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-4">
        <Link href="/sales?tab=quotations" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Draft Quotations</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{myQuotationsDraft}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">Open drafts →</p>
        </Link>
        <Link href="/sales?tab=quotations" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Sent Quotations</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{myQuotationsSent}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">Track sent →</p>
        </Link>
        <Link href="/sales" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Active Leads</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{myLeads}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">View my leads →</p>
        </Link>
        <Link href="/documents/invoices" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Open Invoices</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{openInvoices}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">Open invoices →</p>
        </Link>
      </div>
    </div>
  );
}

export async function SalesRetailDashboard({ userId, orgId }: { userId: string; orgId: string | null }) {
  const orgFilter = orgId ? { orgId } : {};
  const myLeadAccess = { OR: [{ assignedToId: userId }, { createdById: userId }] };
  const [myLeads, myQuotations, posOpen] = await Promise.all([
    prisma.lead.count({
      where: {
        ...orgFilter,
        ...myLeadAccess,
        status: { notIn: ["WON", "LOST", "STALE"] },
      },
    }).catch(() => 0),
    prisma.quotation.count({
      where: {
        ...orgFilter,
        createdById: userId,
        status: { in: ["DRAFT", "SENT"] },
      },
    }).catch(() => 0),
    prisma.posSession.count({
      where: { ...orgFilter, operatorId: userId, status: "OPEN" },
    }).catch(() => 0),
  ]);

  return (
    <div className="space-y-4">
      <DashboardHero
        title="Retail Sales Desk"
        summary="Manage your active leads, open quotations, and daily POS sessions."
        primaryHref="/sales"
        primaryLabel={routeLabel("/sales")}
        secondaryHref="/pos"
        secondaryLabel={routeLabel("/pos")}
      />

      <StickyKpiRow
        items={[
          { label: "My Leads", value: String(myLeads), href: "/sales", tone: "brand" },
          { label: "Quotations", value: String(myQuotations), href: "/sales?tab=quotations", tone: "warning" },
          { label: "POS Sessions", value: String(posOpen), href: "/pos", tone: "success" },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Link href="/sales" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">My Leads</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{myLeads}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">View leads →</p>
        </Link>
        <Link href="/sales?tab=quotations" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">My Quotations</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{myQuotations}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">View quotations →</p>
        </Link>
        <Link href="/pos" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Active POS</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{posOpen}</p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">Open POS →</p>
        </Link>
      </div>
    </div>
  );
}
