// Reads the live session and org-scoped DB rows, so it must never be
// prerendered at build time. Aligns with the force-dynamic convention used
// across the app.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, JobStatus, InvoiceStatus } from "@prisma/client";

import { resolveTechCost } from "@/lib/billing";
import { formatMoneyCompact, getAppCurrency } from "@/lib/currency";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { PAYMENT_METHODS, formatPaymentMethodLabel } from "@/lib/constants/payment-methods";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { clientDisplayName } from "@/lib/client-name";

import { icontains } from "@/lib/db/search";
import { receiveInvoicePaymentAction } from "./actions";
type SearchParams = {
  q?: string;
  tech?: string;
  page?: string;
  section?: string;
  bucket?: string;
  error?: string;
};

const PAGE_SIZE = 20;
const TERMINAL = filterSupportedJobStatuses(["READY_FOR_PICKUP", "COMPLETED", "DELIVERED"]) as JobStatus[];
const UNPAID_INV_STATUSES = ["ISSUED"] as InvoiceStatus[];

function buildJobSearch(q?: string): Prisma.JobWhereInput {
  if (!q) return {};
  return {
    OR: [
      { jobNumber: icontains(q) },
      { client: { OR: [{ fullName: icontains(q) }, { organization: icontains(q) }] } },
      { assignedTo: { is: { name: icontains(q) } } },
    ],
  };
}

function buildInvoiceSearch(q?: string): Prisma.InvoiceWhereInput {
  if (!q) return {};
  return {
    OR: [
      { invoiceNumber: icontains(q) },
      { client: { OR: [{ fullName: icontains(q) }, { organization: icontains(q) }] } },
      { subject: icontains(q) },
    ],
  };
}

function daysOverdue(date: Date | null): number | null {
  if (!date) return null;
  const diff = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  return diff > 0 ? diff : null;
}

export default async function PayoutFollowupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, orgId } = await requireOrgSession();

  const canSeeRepairs = can.approveInvoices(user) || can.reviewExternalBills(user);
  const canSeeInvoices = can.approveInvoices(user);
  // Per-document PDF links only render where the route would let them through.
  const canInvoicePdf = can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role);

  if (!canSeeRepairs && !canSeeInvoices) {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const page = Math.max(Number(filters.page ?? "1") || 1, 1);
  const currency = getAppCurrency();
  const jobSearch = buildJobSearch(filters.q);
  const invSearch = buildInvoiceSearch(filters.q);
  const techFilter = filters.tech ? { assignedToId: filters.tech } : {};

  // ── Repair collections ────────────────────────────────────────────────────
  const clientWhere: Prisma.JobWhereInput = {
    orgId,
    clientBill: { gt: 0 },
    clientPaid: false,
    status: { in: TERMINAL },
    // Dedup: once a job has a formal invoice it's collected under Invoice
    // Collections, so it doesn't also appear (or double-count) here.
    invoice: { is: null },
    ...jobSearch,
    ...techFilter,
  };

  // ── Invoice receivables ───────────────────────────────────────────────────
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    orgId,
    status: { in: UNPAID_INV_STATUSES },
    ...invSearch,
  };

  const [
    clientRows, clientTotal,
    invoiceRows, invoiceTotal,
    technicians,
    // Summary aggregates (unfiltered for header cards)
    repairSummary,
    invoiceSummary,
  ] = await Promise.all([
    // Repair client rows
    canSeeRepairs ? prisma.job.findMany({
      where: clientWhere,
      orderBy: [{ deliveredAt: "desc" }, { completedAt: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, jobNumber: true, status: true, repairPath: true,
        clientBill: true, externalTechFee: true, externalTechBill: true,
        completedAt: true, deliveredAt: true,
        client: { select: { fullName: true, phone: true, organization: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }) : Promise.resolve([]),
    canSeeRepairs ? prisma.job.count({ where: clientWhere }) : Promise.resolve(0),

    // Invoice rows
    canSeeInvoices ? prisma.invoice.findMany({
      where: invoiceWhere,
      orderBy: [{ dueDate: "asc" }, { issuedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, invoiceNumber: true, invoiceType: true, subject: true,
        status: true, totalAmount: true, paidAmount: true,
        dueDate: true, issuedAt: true,
        client: { select: { fullName: true, phone: true, organization: true } },
      },
    }) : Promise.resolve([]),
    canSeeInvoices ? prisma.invoice.count({ where: invoiceWhere }) : Promise.resolve(0),

    // Technician filter options
    prisma.user.findMany({
      where: { orgId, role: { in: ["TECHNICIAN_EXTERNAL", "TECHNICIAN_INTERNAL"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),

    // Summary aggregates (unfiltered)
    canSeeRepairs ? prisma.job.aggregate({
      // Mirror clientWhere's dedup so the header total doesn't double-count invoiced jobs.
      where: { orgId, clientBill: { gt: 0 }, clientPaid: false, status: { in: TERMINAL }, invoice: { is: null } },
      _sum: { clientBill: true },
      _count: { id: true },
    }) : Promise.resolve({ _sum: { clientBill: null }, _count: { id: 0 } }),
    canSeeInvoices ? prisma.invoice.aggregate({
      where: { orgId, status: { in: UNPAID_INV_STATUSES } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { id: true },
    }) : Promise.resolve({ _sum: { totalAmount: null, paidAmount: null }, _count: { id: 0 } }),
  ]);

  // Compute summary values
  const repairReceivable = repairSummary._sum.clientBill ?? 0;
  const invoiceReceivable = (invoiceSummary._sum.totalAmount ?? 0) - (invoiceSummary._sum.paidAmount ?? 0);

  // Pagination preserves the active section + filters.
  const preserved = Object.fromEntries(
    Object.entries(filters).filter(([k, v]) => k !== "page" && typeof v === "string" && v.length > 0),
  ) as Record<string, string>;

  // Shell view: only the active section's list renders, so the two lists no
  // longer stack into one endless page that pushes everything off-screen.
  // Outgoing money lives on the Payables page now — this one is collections.
  const sectionTabs = [
    { key: "invoices", label: "Invoice Collections", count: invoiceTotal, allowed: canSeeInvoices, dot: "bg-[var(--accent)]" },
    { key: "repairs", label: "Client Payments", count: clientTotal, allowed: canSeeRepairs, dot: "bg-amber-400" },
  ].filter((t) => t.allowed);
  const requestedSection = filters.section ?? "";
  const activeTab = sectionTabs.some((t) => t.key === requestedSection) ? requestedSection : (sectionTabs[0]?.key ?? "invoices");
  function tabHref(key: string) {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.tech) p.set("tech", filters.tech);
    p.set("section", key);
    return `?${p.toString()}`;
  }

  // Paginate only the active section (each list has its own row count).
  const activeSectionCount = activeTab === "invoices" ? invoiceTotal : clientTotal;
  // CSV export of the active list, honouring the same search filters.
  const exportHref = (() => {
    const p = new URLSearchParams();
    p.set("section", activeTab);
    if (filters.q) p.set("q", filters.q);
    if (filters.tech) p.set("tech", filters.tech);
    return `/api/payout-followups/export?${p.toString()}`;
  })();
  const totalPages = Math.max(Math.ceil(activeSectionCount / PAGE_SIZE), 1);
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  const totalReceivable = repairReceivable + invoiceReceivable;

  return (
    <ListPageLayout
      headerNode={
        <>
          <FormErrorBanner message={filters.error} />
          <PageHeader
            title="Collections"
            description={
              totalReceivable > 0
                ? `${formatMoneyCompact(totalReceivable, currency)} accounts receivable`
                : "Nothing outstanding — all settled"
            }
          />
          <StatCards
            cards={[
            ...(canSeeRepairs ? [{
              label: "Repair Collections",
              value: formatMoneyCompact(repairReceivable, currency),
              valueClass: "text-amber-500",
              sub: `${repairSummary._count.id} job${repairSummary._count.id !== 1 ? "s" : ""} pending`,
            }] : []),
            ...(canSeeInvoices ? [{
              label: "Invoice Receivables",
              value: formatMoneyCompact(invoiceReceivable, currency),
              valueClass: "text-[var(--accent)]",
              sub: `${invoiceSummary._count.id} invoice${invoiceSummary._count.id !== 1 ? "s" : ""} outstanding`,
            }] : []),
            ]}
          />
        </>
      }
    >
      {/* Quick links */}
      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/payables" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
          → Payables
        </Link>
        {canSeeInvoices && (
          <Link href="/documents/invoices" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
            → All Invoices
          </Link>
        )}
        {canSeeRepairs && (
          <Link href="/jobs" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
            → All Jobs
          </Link>
        )}
        <Link href="/finance/accounts" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
          → Finance Dashboard
        </Link>
      </div>

      {/* Section tabs — shell view: pick one list at a time instead of stacking. Sticky so the switcher never scrolls away on long lists. */}
      <div className="sticky top-0 z-10 flex flex-wrap gap-2 overflow-x-auto bg-[var(--bg)]/95 py-2 backdrop-blur-sm [scrollbar-width:none]">
        {sectionTabs.map((t) => {
          const active = t.key === activeTab;
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-[0.8125rem] font-semibold transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--ink)]"
                  : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${t.dot}`} />
              {t.label}
              <span className="rounded-full bg-[var(--panel-strong)] px-1.5 py-0.5 text-[0.6875rem] tabular-nums text-[var(--ink-muted)]">{t.count}</span>
            </Link>
          );
        })}
      </div>

      {/* Filters */}
      <section className="dc-card p-3">
        <form className="flex flex-wrap items-center gap-2">
          {/* Stay on the active list when filtering. */}
          <input type="hidden" name="section" value={activeTab} />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search job #, client, invoice #, supplier…"
            className="min-w-[240px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]/40"
          />
          {canSeeRepairs && (
            <select name="tech" defaultValue={filters.tech} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm">
              <option value="">All technicians</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>{tech.name}</option>
              ))}
            </select>
          )}
          <SubmitButton bare className="btn-premium-secondary rounded-lg px-3 py-1.5 text-sm">Apply</SubmitButton>
          <Link href={`/payout-followups?section=${activeTab}`} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]">Reset</Link>
          <a href={exportHref} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Download the current list as CSV">↓ CSV</a>
        </form>
      </section>

      {/* ── Section 1: Invoice Collections ─────────────────────────────────── */}
      {activeTab === "invoices" && canSeeInvoices && (
        <section id="invoices" className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            <p className="text-sm font-semibold text-[var(--ink)]">Invoice Collections — Outstanding</p>
            <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[0.75rem] font-semibold text-[var(--accent)] dark:bg-[var(--accent)]/15 dark:text-[var(--accent)]">
              {invoiceTotal}
            </span>
          </div>
          <DataTable
            rows={invoiceRows}
            getRowKey={(inv) => inv.id}
            className="panel-shadow"
            empty={filters.q ? "No results for this search." : "No outstanding invoices — all settled."}
            renderMobileCard={(inv) => {
              const balance = inv.totalAmount - inv.paidAmount;
              const overdueDays = daysOverdue(inv.dueDate);
              return (
                <div className="px-4 py-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Link href={`/documents/invoices/${inv.id}`} className="mono font-bold text-[var(--ink)] hover:text-[var(--accent)]">{inv.invoiceNumber}</Link>
                    {overdueDays != null ? <StatusBadge tone="danger" className="shrink-0">{overdueDays}d overdue</StatusBadge> : <span className="text-emerald-600">On time</span>}
                  </div>
                  <p className="text-[0.8125rem] font-medium text-[var(--ink)]">{clientDisplayName(inv.client, "—")} <span className="text-[0.8125rem] font-normal text-[var(--ink-muted)]">{inv.client?.phone}</span></p>
                  <div className="mt-1 flex items-center gap-3 text-[0.75rem]">
                    <span className="font-semibold text-[var(--accent)] dark:text-[var(--accent)]">{formatMoneyCompact(balance, currency)} due</span>
                    <span className="text-[var(--ink-muted)]">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "No due date"}</span>
                    {canInvoicePdf ? <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="font-semibold text-[var(--ink-muted)] underline">PDF</a> : null}
                  </div>
                  {/* Inline payment form */}
                  <form action={receiveInvoicePaymentAction} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <input name="amount" required type="number" min="0.01" step="0.01" max={balance} defaultValue={String(balance)} placeholder="Amount" className="h-8 w-24 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50" />
                    <select name="method" defaultValue="CASH" className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
                    </select>
                    <SubmitButton bare pendingLabel="…" className="h-8 rounded-lg bg-emerald-600 px-3 text-[0.75rem] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">Collect</SubmitButton>
                  </form>
                </div>
              );
            }}
            columns={[
              {
                key: "invoice",
                header: "Invoice #",
                className: "font-semibold",
                cell: (inv) => <Link href={`/documents/invoices/${inv.id}`} className="hover:text-[var(--accent)] transition-colors">{inv.invoiceNumber}</Link>,
              },
              {
                key: "client",
                header: "Client",
                cell: (inv) => <><p className="font-medium">{clientDisplayName(inv.client, "—")}</p><p className="text-[0.75rem] text-[var(--ink-muted)]">{inv.client?.phone ?? ""}</p></>,
              },
              {
                key: "type",
                header: "Type",
                cell: (inv) => <StatusBadge tone="violet" className="capitalize">{inv.invoiceType.toLowerCase()}</StatusBadge>,
              },
              { key: "subject", header: "Subject", className: "max-w-[180px] truncate text-[var(--ink-muted)]", cell: (inv) => inv.subject ?? "—" },
              { key: "total", header: "Total", className: "whitespace-nowrap tabular-nums", cell: (inv) => formatMoneyCompact(inv.totalAmount, currency) },
              {
                key: "paid",
                header: "Paid",
                className: "whitespace-nowrap tabular-nums",
                cell: (inv) => inv.paidAmount > 0 ? <span className="text-emerald-700 dark:text-emerald-400">{formatMoneyCompact(inv.paidAmount, currency)}</span> : <span className="text-[var(--ink-muted)]">—</span>,
              },
              { key: "balance", header: "Balance", className: "font-semibold text-[var(--accent)] dark:text-[var(--accent)] whitespace-nowrap tabular-nums", cell: (inv) => formatMoneyCompact(inv.totalAmount - inv.paidAmount, currency) },
              { key: "due", header: "Due Date", className: "text-[0.75rem] text-[var(--ink-muted)]", cell: (inv) => inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—" },
              {
                key: "overdue",
                header: "Overdue",
                cell: (inv) => {
                  const overdueDays = daysOverdue(inv.dueDate);
                  return overdueDays != null ? <StatusBadge tone="danger">{overdueDays}d overdue</StatusBadge> : <span className="text-[var(--ink-muted)] text-[0.75rem]">On time</span>;
                },
              },
            ]}
            actions={(inv) => {
              const balance = inv.totalAmount - inv.paidAmount;
              return (
                <>
                  <form action={receiveInvoicePaymentAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <input name="amount" required type="number" min="0.01" step="0.01" max={balance} defaultValue={String(balance)} placeholder="Amt" className="h-8 w-20 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none focus:border-emerald-500/50" />
                    <select name="method" defaultValue="CASH" className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
                    </select>
                    <SubmitButton bare pendingLabel="…" className="h-8 rounded-lg bg-emerald-600 px-2.5 text-[0.75rem] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">Collect</SubmitButton>
                  </form>
                  {canInvoicePdf ? <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="h-8 inline-flex items-center rounded-lg border border-[var(--line)] px-2 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">PDF</a> : null}
                  <Link href={`/documents/invoices/${inv.id}`} className="h-8 inline-flex items-center rounded-lg border border-[var(--line)] px-2 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">View</Link>
                </>
              );
            }}
          />
        </section>
      )}

      {/* ── Section 2: Repair Client Collections ───────────────────────────── */}
      {activeTab === "repairs" && canSeeRepairs && (
        <section id="repairs" className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            <p className="text-sm font-semibold text-[var(--ink)]">Repair Client Payments — Outstanding</p>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.75rem] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {clientTotal}
            </span>
          </div>
          <DataTable
            rows={clientRows}
            getRowKey={(job) => job.id}
            className="panel-shadow"
            empty={filters.q || filters.tech ? "No results for these filters." : "All repair client payments are settled."}
            renderMobileCard={(job) => {
              const doneAt = job.deliveredAt ?? job.completedAt;
              return (
                <div className="px-4 py-3">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <Link href={`/jobs/${job.id}?tab=financials&returnTo=/payout-followups&returnLabel=Finance+Hub`} className="mono text-[0.8125rem] font-bold text-[var(--accent)]">{job.jobNumber}</Link>
                    <span className="text-[0.75rem] font-semibold text-amber-700 dark:text-amber-400">{formatMoneyCompact(job.clientBill ?? 0, currency)}</span>
                  </div>
                  <p className="font-medium text-[var(--ink)]">{clientDisplayName(job.client, "—")} <span className="font-normal text-[var(--ink-muted)]">{job.client?.phone}</span></p>
                  <p className="mt-0.5 text-[var(--ink-muted)]">{job.assignedTo?.name ?? "Unassigned"}{doneAt ? ` · ${new Date(doneAt).toLocaleDateString()}` : ""}</p>
                </div>
              );
            }}
            columns={[
              {
                key: "job",
                header: "Job",
                className: "font-semibold",
                cell: (job) => <Link href={`/jobs/${job.id}?tab=financials&returnTo=/payout-followups&returnLabel=Finance+Hub`} className="hover:text-[var(--accent)] transition-colors">{job.jobNumber}</Link>,
              },
              {
                key: "client",
                header: "Client",
                cell: (job) => <><p className="font-medium">{clientDisplayName(job.client, "—")}</p><p className="text-[0.75rem] text-[var(--ink-muted)]">{job.client?.phone ?? "—"}</p></>,
              },
              { key: "assigned", header: "Assigned To", cell: (job) => job.assignedTo?.name ?? "Unassigned" },
              {
                key: "type",
                header: "Type",
                cell: (job) => job.repairPath === "EXTERNAL"
                  ? <StatusBadge tone="info">External</StatusBadge>
                  : <StatusBadge tone="accent">In-house</StatusBadge>,
              },
              {
                key: "repairCost",
                header: "Repair Cost",
                className: "whitespace-nowrap tabular-nums",
                cell: (job) => {
                  const repairCost = resolveTechCost(job.externalTechFee, job.externalTechBill);
                  return repairCost > 0 ? formatMoneyCompact(repairCost, currency) : <span className="text-[var(--ink-muted)]">—</span>;
                },
              },
              { key: "clientBill", header: "Client Bill", className: "font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap tabular-nums", cell: (job) => formatMoneyCompact(job.clientBill ?? 0, currency) },
              {
                key: "doneAt",
                header: "Done At",
                className: "text-[0.75rem] text-[var(--ink-muted)]",
                cell: (job) => {
                  const doneAt = job.deliveredAt ?? job.completedAt;
                  return doneAt ? new Date(doneAt).toLocaleDateString() : "—";
                },
              },
            ]}
            actions={(job) => (
              <Link href={`/jobs/${job.id}?tab=financials&returnTo=/payout-followups&returnLabel=Finance+Hub`} className="btn-premium-secondary rounded-lg px-3 py-1.5">Open</Link>
            )}
          />
        </section>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`?${new URLSearchParams({ ...preserved, page: String(prevPage) }).toString()}`}
            aria-disabled={page <= 1}
            className={`btn-premium-secondary rounded-lg px-3 py-1.5 text-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            Prev
          </Link>
          <span className="text-xs text-[var(--ink-muted)]">Page {page} / {totalPages}</span>
          <Link
            href={`?${new URLSearchParams({ ...preserved, page: String(nextPage) }).toString()}`}
            aria-disabled={page >= totalPages}
            className={`btn-premium-secondary rounded-lg px-3 py-1.5 text-sm ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            Next
          </Link>
        </div>
      )}
    </ListPageLayout>
  );
}
