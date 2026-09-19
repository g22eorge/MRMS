// Reads the live session and org-scoped DB rows, so it must never be
// prerendered at build time. Aligns with the force-dynamic convention used
// across the app.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, JobStatus, SupplierBillStatus } from "@prisma/client";

import { resolveTechCost } from "@/lib/billing";
import { formatMoneyCompact, getAppCurrency, rowToBase } from "@/lib/currency";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { can } from "@/lib/permissions";
import { getTechnicianPayoutTotalsByJobIds } from "@/lib/payouts";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { PAYMENT_METHODS, formatPaymentMethodLabel } from "@/lib/constants/payment-methods";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { clientDisplayName } from "@/lib/client-name";

import { icontains } from "@/lib/db/search";
import {
  markExternalTechPaid,
  paySupplierBillAction,
  payExpenseAction,
  payBucketAction,
} from "../payout-followups/actions";
type SearchParams = {
  q?: string;
  tech?: string;
  page?: string;
  section?: string;
  bucket?: string;
  error?: string;
  saved?: string;
};

const PAGE_SIZE = 20;
const TERMINAL = filterSupportedJobStatuses(["READY_FOR_PICKUP", "COMPLETED", "DELIVERED"]) as JobStatus[];
const UNPAID_BILL_STATUSES = ["POSTED", "PART_PAID"] as SupplierBillStatus[];

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

function buildBillSearch(q?: string): Prisma.SupplierBillWhereInput {
  if (!q) return {};
  return {
    OR: [
      { billNumber: icontains(q) },
      { supplier: { name: icontains(q) } },
    ],
  };
}

function daysOverdue(date: Date | null): number | null {
  if (!date) return null;
  const diff = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  return diff > 0 ? diff : null;
}

type CreditorRow =
  | { kind: "BILL"; id: string; creditor: string; ref: string; detail: string; balance: number; currency: string; ageDays: number; ageLabel: string; dueAt: Date | null; status: string }
  | { kind: "EXPENSE"; id: string; creditor: string; ref: string; detail: string; balance: number; currency: string; ageDays: number; ageLabel: string; createdAt: Date; category: string; method: string | null }
  | { kind: "TECH"; id: string; creditor: string; ref: string; detail: string; balance: number; currency: string; ageDays: number; ageLabel: string; jobNumber: string };

// Inline pay forms for a payables row: clear (or part-pay, for bills) without leaving the page.
function PayablesRowPay({ r }: { r: CreditorRow }) {
  if (r.kind === "BILL") {
    return (
      <form action={paySupplierBillAction} className="flex items-center gap-1.5">
        <input type="hidden" name="billId" value={r.id} />
        <input type="hidden" name="section" value="payables" />
        <input name="amount" required type="number" min="0.01" step="0.01" max={r.balance} defaultValue={String(r.balance)} placeholder="Amt" className="h-8 w-20 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none focus:border-emerald-500/50" />
        <select name="method" defaultValue="CASH" className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none">
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
        </select>
        <SubmitButton bare pendingLabel="…" className="h-8 rounded-lg bg-emerald-600 px-2.5 text-[0.75rem] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">Pay</SubmitButton>
      </form>
    );
  }
  if (r.kind === "EXPENSE") {
    return (
      <form action={payExpenseAction} className="flex items-center gap-1.5">
        <input type="hidden" name="expenseId" value={r.id} />
        <input name="amount" required type="number" min="0.01" step="0.01" max={r.balance} defaultValue={String(r.balance)} placeholder="Amt" className="h-8 w-20 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none focus:border-emerald-500/50" />
        <input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none" />
        <select name="method" defaultValue="CASH" className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none">
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
        </select>
        <SubmitButton bare pendingLabel="…" className="h-8 rounded-lg bg-emerald-600 px-2.5 text-[0.75rem] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">Pay</SubmitButton>
      </form>
    );
  }
  return (
    <form action={markExternalTechPaid}>
      <input type="hidden" name="jobId" value={r.id} />
      <ConfirmSubmitButton
        message="Record this technician payout? This can't be undone."
        confirmLabel="Mark paid"
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 font-bold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400">
        Mark Paid
      </ConfirmSubmitButton>
    </form>
  );
}

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, orgId, org } = await requireOrgSession();

  const canSeeRepairs = can.approveInvoices(user) || can.reviewExternalBills(user);
  const canSeeBills = can.approveInvoices(user) || can.runFinancialReports(user);
  const canSeeExpenses = can.viewFinancials(user);
  const canSeePayables = canSeeBills || canSeeRepairs || canSeeExpenses;
  const canBillPdf = can.manageInventory(user);
  const canJobCard = can.generateJobCards(user);

  if (!canSeeRepairs && !canSeeBills && !canSeeExpenses) {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const page = Math.max(Number(filters.page ?? "1") || 1, 1);
  const currency = getAppCurrency();
  const jobSearch = buildJobSearch(filters.q);
  const billSearch = buildBillSearch(filters.q);
  const techFilter = filters.tech ? { assignedToId: filters.tech } : {};

  // ── External tech payouts ─────────────────────────────────────────────────
  const techWhere: Prisma.JobWhereInput = {
    orgId,
    repairPath: "EXTERNAL",
    externalPaid: false,
    status: { in: TERMINAL },
    ...jobSearch,
    ...techFilter,
  };

  // ── Supplier bills payable ────────────────────────────────────────────────
  const billWhere: Prisma.SupplierBillWhereInput = {
    orgId,
    status: { in: UNPAID_BILL_STATUSES },
    ...billSearch,
  };

  const [
    techRows, techTotal,
    billRows, billTotal,
    technicians,
    // Summary aggregates (unfiltered for header cards)
    techSummary,
    billSummary,
  ] = await Promise.all([
    // External tech rows
    canSeeRepairs ? prisma.job.findMany({
      where: techWhere,
      orderBy: [{ deliveredAt: "desc" }, { completedAt: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, jobNumber: true, status: true,
        clientBill: true, externalTechFee: true, externalTechBill: true,
        completedAt: true, deliveredAt: true,
        client: { select: { fullName: true, phone: true, organization: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }) : Promise.resolve([]),
    canSeeRepairs ? prisma.job.count({ where: techWhere }) : Promise.resolve(0),

    // Supplier bill rows
    canSeeBills ? prisma.supplierBill.findMany({
      where: billWhere,
      orderBy: [{ dueAt: "asc" }, { issuedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, billNumber: true, status: true,
        totalAmount: true, paidAmount: true,
        dueAt: true, issuedAt: true,
        supplier: { select: { name: true } },
      },
    }) : Promise.resolve([]),
    canSeeBills ? prisma.supplierBill.count({ where: billWhere }) : Promise.resolve(0),

    // Technician filter options
    prisma.user.findMany({
      where: { orgId, role: { in: ["TECHNICIAN_EXTERNAL", "TECHNICIAN_INTERNAL"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),

    // Summary aggregates (unfiltered)
    canSeeRepairs ? prisma.job.aggregate({
      where: { orgId, repairPath: "EXTERNAL", externalPaid: false, status: { in: TERMINAL } },
      _sum: { externalTechFee: true, externalTechBill: true },
      _count: { id: true },
    }) : Promise.resolve({ _sum: { externalTechFee: null, externalTechBill: null }, _count: { id: 0 } }),
    canSeeBills ? prisma.supplierBill.aggregate({
      where: { orgId, status: { in: UNPAID_BILL_STATUSES } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { id: true },
    }) : Promise.resolve({ _sum: { totalAmount: null, paidAmount: null }, _count: { id: 0 } }),
  ]);

  // Compute summary values
  const techSummaryRows = canSeeRepairs ? await prisma.job.findMany({
    where: { orgId, repairPath: "EXTERNAL", externalPaid: false, status: { in: TERMINAL } },
    select: { id: true, externalTechFee: true, externalTechBill: true, completedAt: true, deliveredAt: true, assignedTo: { select: { name: true } } },
  }) : [];
  const techSummaryPayoutTotals = await getTechnicianPayoutTotalsByJobIds(techSummaryRows.map((job) => job.id));
  const _techPayoutDue = techSummaryRows.reduce((sum, job) => {
    const paid = techSummaryPayoutTotals.get(job.id)?.paidAmount ?? 0;
    return sum + Math.max(0, resolveTechCost(job.externalTechFee, job.externalTechBill) - paid);
  }, 0);
  const billPayable = (billSummary._sum.totalAmount ?? 0) - (billSummary._sum.paidAmount ?? 0);
  const techPayoutTotals = await getTechnicianPayoutTotalsByJobIds(techRows.map((job) => job.id));

  function paidToTechnician(jobId: string) {
    return techPayoutTotals.get(jobId)?.paidAmount ?? 0;
  }

  function remainingTechnicianPayout(job: typeof techRows[number]) {
    return Math.max(0, resolveTechCost(job.externalTechFee, job.externalTechBill) - paidToTechnician(job.id));
  }

  // ── Payables union: every open debt in one list ──────────────────────────
  // Bills + unpaid expenses + tech dues, oldest 200 rows for the table;
  // header totals and creditor rollups use full-set aggregates.
  const baseCurrency = org.baseCurrency;
  const toBase = (amount: number, curr: string | null | undefined, rate: number | null | undefined) =>
    rowToBase({ amount, currency: curr ?? baseCurrency, exchangeRateToBase: rate ?? null }, baseCurrency);

  const expenseWhereBase = { orgId, paidAt: null };
  const expenseSearch = filters.q
    ? { OR: [{ description: icontains(filters.q) }, { supplier: { name: icontains(filters.q) } }] }
    : {};
  const [
    payBillRows,
    payExpenseRows,
    payTechRows,
    billCreditorGroups,
    expenseCreditorGroups,
    expenseUnlinkedGroups,
    billSuppliers,
    expenseSuppliers,
  ] = await Promise.all([
    canSeeBills ? prisma.supplierBill.findMany({
      where: { orgId, status: { in: UNPAID_BILL_STATUSES }, ...billSearch },
      orderBy: [{ dueAt: "asc" }, { issuedAt: "asc" }],
      take: 200,
      select: { id: true, billNumber: true, status: true, totalAmount: true, paidAmount: true, currency: true, exchangeRateToBase: true, dueAt: true, issuedAt: true, supplier: { select: { name: true } } },
    }) : Promise.resolve([]),
    canSeeExpenses ? prisma.expense.findMany({
      where: { ...expenseWhereBase, ...expenseSearch },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, expenseNumber: true, description: true, amount: true, paidAmount: true, currency: true, exchangeRateToBase: true, category: true, createdAt: true, dueAt: true, method: true, supplier: { select: { name: true } } },
    }) : Promise.resolve([]),
    canSeeRepairs ? prisma.job.findMany({
      where: { ...techWhere },
      orderBy: [{ deliveredAt: "asc" }, { completedAt: "asc" }, { updatedAt: "asc" }],
      take: 200,
      select: { id: true, jobNumber: true, status: true, externalTechFee: true, externalTechBill: true, completedAt: true, deliveredAt: true, updatedAt: true, assignedTo: { select: { id: true, name: true } } },
    }) : Promise.resolve([]),
    canSeeBills ? prisma.supplierBill.groupBy({
      by: ["supplierId", "currency", "exchangeRateToBase"],
      where: { orgId, status: { in: UNPAID_BILL_STATUSES } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { id: true },
    }) : Promise.resolve([]),
    canSeeExpenses ? prisma.expense.groupBy({
      by: ["supplierId", "currency", "exchangeRateToBase"],
      where: { ...expenseWhereBase, supplierId: { not: null } },
      _sum: { amount: true },
      _count: { id: true },
    }) : Promise.resolve([]),
    canSeeExpenses ? prisma.expense.groupBy({
      by: ["currency", "exchangeRateToBase"],
      where: { ...expenseWhereBase, supplierId: null },
      _sum: { amount: true },
      _count: { id: true },
    }) : Promise.resolve([]),
    canSeeBills ? prisma.supplier.findMany({ where: { orgId }, select: { id: true, name: true } }) : Promise.resolve([]),
    canSeeExpenses ? prisma.supplier.findMany({ where: { orgId }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const payTechTotals = await getTechnicianPayoutTotalsByJobIds(payTechRows.map((j) => j.id));

  const DAY = 86_400_000;
  const ageOf = (d: Date | null | undefined) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / DAY)) : 0);
  const daysUntil = (d: Date | null | undefined) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / DAY) : null);

  const creditorRows: CreditorRow[] = [
    ...payBillRows.map((b): CreditorRow => {
      const balance = b.totalAmount - b.paidAmount;
      const overdue = daysOverdue(b.dueAt);
      const until = daysUntil(b.dueAt);
      return {
        kind: "BILL", id: b.id, creditor: b.supplier.name, ref: b.billNumber,
        detail: b.status === "PART_PAID" ? `Part paid ${formatMoneyCompact(b.paidAmount, currency)}` : "Posted",
        balance, currency: b.currency || baseCurrency,
        ageDays: overdue ?? 0,
        ageLabel: overdue != null ? `${overdue}d overdue` : until != null && until > 0 ? `Due in ${until}d` : b.dueAt ? "Due now" : "No due date",
        dueAt: b.dueAt, status: b.status,
      };
    }),
    ...payExpenseRows.map((e): CreditorRow => {
      // Maturity follows the due date when set, otherwise the time owed.
      const overdue = daysOverdue(e.dueAt);
      const until = daysUntil(e.dueAt);
      const balance = Math.max(0, e.amount - e.paidAmount);
      const age = overdue ?? ageOf(e.createdAt);
      return {
        kind: "EXPENSE", id: e.id, creditor: e.supplier?.name ?? "Unlinked payee", ref: e.expenseNumber,
        detail: e.paidAmount > 0 ? `${e.description} (part paid)` : e.description,
        balance, currency: e.currency || baseCurrency,
        ageDays: age,
        ageLabel: overdue != null ? `${overdue}d overdue` : until != null && until > 0 ? `Due in ${until}d` : age === 0 ? "Recorded today" : `${age}d owed`,
        createdAt: e.createdAt, category: e.category, method: e.method,
      };
    }),
    ...payTechRows.map((j): CreditorRow => {
      const paid = payTechTotals.get(j.id)?.paidAmount ?? 0;
      const remaining = Math.max(0, resolveTechCost(j.externalTechFee, j.externalTechBill) - paid);
      const since = j.deliveredAt ?? j.completedAt ?? j.updatedAt;
      const age = ageOf(since);
      return {
        kind: "TECH", id: j.id, creditor: j.assignedTo?.name ?? "Unassigned tech", ref: j.jobNumber,
        detail: paid > 0 ? `Part paid ${formatMoneyCompact(paid, currency)}` : String(j.status).replace(/_/g, " "),
        balance: remaining, currency: baseCurrency,
        ageDays: age, ageLabel: age === 0 ? "Due now" : `${age}d owed`,
        jobNumber: j.jobNumber,
      };
    }),
  ].filter((r) => r.balance > 0);

  // Aging buckets mirror the invoice collections (current / 1–30 / 31–60 /
  // 61+). Bills age from their due date (not yet due, or no due date, is
  // Current); expenses and tech dues are payable immediately, so they age
  // from creation/completion.
  const bucketOf = (age: number) => (age <= 0 ? "current" : age <= 30 ? "d30" : age <= 60 ? "d60" : "d61");
  const bucketFilter = (["current", "d30", "d60", "d61"] as const).includes(filters.bucket as never) ? (filters.bucket as string) : "all";
  const bucketedRows = bucketFilter === "all" ? creditorRows : creditorRows.filter((r) => bucketOf(r.ageDays) === bucketFilter);
  // Oldest debts first — maturity order.
  bucketedRows.sort((a, b) => b.ageDays - a.ageDays);

  // Creditor rollup over the FULL open sets (exact, not page-bound).
  const supplierNameById = new Map([...billSuppliers, ...expenseSuppliers].map((s) => [s.id, s.name] as const));
  const creditorTotals = new Map<string, { base: number; count: number }>();
  const addCreditor = (name: string, base: number, count: number | undefined) => {
    if (!(base > 0)) return;
    const prev = creditorTotals.get(name) ?? { base: 0, count: 0 };
    creditorTotals.set(name, { base: prev.base + base, count: prev.count + (count ?? 0) });
  };
  for (const g of billCreditorGroups) {
    addCreditor(
      supplierNameById.get(g.supplierId ?? "") ?? "Unknown supplier",
      toBase((g._sum.totalAmount ?? 0) - (g._sum.paidAmount ?? 0), g.currency, g.exchangeRateToBase),
      g._count.id,
    );
  }
  // Header total (base currency, exact full-set) + creditor rollup entries.
  let expenseUnpaidBase = 0;
  for (const g of expenseCreditorGroups) {
    const base = toBase(g._sum.amount ?? 0, g.currency, g.exchangeRateToBase);
    expenseUnpaidBase += base;
    addCreditor(supplierNameById.get(g.supplierId ?? "") ?? "Unknown supplier", base, g._count.id);
  }
  let unlinkedBase = 0;
  let unlinkedCount = 0;
  for (const g of expenseUnlinkedGroups) {
    unlinkedBase += toBase(g._sum.amount ?? 0, g.currency, g.exchangeRateToBase);
    unlinkedCount += g._count.id;
  }
  expenseUnpaidBase += unlinkedBase;
  if (unlinkedCount > 0) {
    addCreditor("Unlinked payees", unlinkedBase, unlinkedCount);
  }
  const topCreditors = [...creditorTotals.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.base - a.base)
    .slice(0, 10);

  // Pagination preserves the active section + filters.
  const preserved = Object.fromEntries(
    Object.entries(filters).filter(([k, v]) => k !== "page" && typeof v === "string" && v.length > 0),
  ) as Record<string, string>;

  // Shell view: only the active section's list renders, so the lists no
  // longer stack into one endless page that pushes everything off-screen.
  const sectionTabs = [
    { key: "payables", label: "Payables", count: bucketedRows.length, allowed: canSeePayables, dot: "bg-rose-400" },
    { key: "bills", label: "Supplier Bills", count: billTotal, allowed: canSeeBills, dot: "bg-red-400" },
    { key: "tech", label: "Tech Payouts", count: techTotal, allowed: canSeeRepairs, dot: "bg-sky-400" },
  ].filter((t) => t.allowed);
  const requestedSection = filters.section ?? "";
  const activeTab = sectionTabs.some((t) => t.key === requestedSection) ? requestedSection : (sectionTabs[0]?.key ?? "payables");
  function tabHref(key: string) {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.tech) p.set("tech", filters.tech);
    if (filters.bucket) p.set("bucket", filters.bucket);
    p.set("section", key);
    return `?${p.toString()}`;
  }

  // Paginate only the active section (each list has its own row count).
  const activeSectionCount = activeTab === "bills" ? billTotal : activeTab === "payables" ? bucketedRows.length : techTotal;
  // CSV export of the active list, honouring the same search + bucket filters.
  const exportHref = (() => {
    const p = new URLSearchParams();
    p.set("section", activeTab);
    if (filters.q) p.set("q", filters.q);
    if (filters.tech) p.set("tech", filters.tech);
    if (filters.bucket) p.set("bucket", filters.bucket);
    return `/api/payout-followups/export?${p.toString()}`;
  })();
  const totalPages = Math.max(Math.ceil(activeSectionCount / PAGE_SIZE), 1);
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  const totalPayable    = billPayable + _techPayoutDue + expenseUnpaidBase;
  // Payables rows honor the shared pager like every other tab.
  const pagedPayablesRows = bucketedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <ListPageLayout
      headerNode={
        <>
          <FormErrorBanner message={filters.error} />
          {filters.saved ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              {filters.saved}
            </p>
          ) : null}
          <PageHeader
            title="Payables"
            description={
              totalPayable > 0
                ? `${formatMoneyCompact(totalPayable, currency)} accounts payable across bills, tech payouts and open expenses`
                : "Nothing owed — all settled"
            }
          />
          <StatCards
            cards={[
            ...(canSeeBills ? [{
              label: "Supplier Bills Due",
              value: formatMoneyCompact(billPayable, currency),
              valueClass: "text-red-500",
              sub: `${billSummary._count.id} bill${billSummary._count.id !== 1 ? "s" : ""} payable`,
            }] : []),
            ...(canSeePayables ? [{
              label: "Accounts Payable",
              value: formatMoneyCompact(billPayable + _techPayoutDue + expenseUnpaidBase, currency),
              valueClass: "text-rose-500",
              sub: "Bills + tech + open expenses",
            }] : []),
            ...(canSeeRepairs ? [{
              label: "Tech Payouts Pending",
              value: formatMoneyCompact(_techPayoutDue, currency),
              valueClass: "text-sky-500",
              sub: `${techSummary._count.id} payout${techSummary._count.id !== 1 ? "s" : ""}`,
            }] : []),
            ]}
          />
        </>
      }
    >
      {/* Quick links */}
      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/payout-followups" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
          → Collections
        </Link>
        {canSeeBills && (
          <Link href="/inventory/supplier-bills" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
            → Supplier Bills
          </Link>
        )}
        <Link href="/finance/expenses?status=unpaid" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
          → Open Expenses
        </Link>
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

      {/* ── Section 2: Supplier Bills Payable ──────────────────────────────── */}
      {activeTab === "bills" && canSeeBills && (
        <section id="bills" className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" />
            <p className="text-sm font-semibold text-[var(--ink)]">Supplier Bills — Payable</p>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.75rem] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
              {billTotal}
            </span>
          </div>
          <DataTable
            rows={billRows}
            getRowKey={(bill) => bill.id}
            className="panel-shadow"
            empty={filters.q ? "No results for this search." : "No outstanding supplier bills — all settled."}
            renderMobileCard={(bill) => {
              const balance = bill.totalAmount - bill.paidAmount;
              const overdueDays = daysOverdue(bill.dueAt);
              return (
                <div className="px-4 py-3">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <Link href={`/inventory/supplier-bills/${bill.id}`} className="mono font-bold text-[var(--ink)] hover:text-[var(--accent)]">{bill.billNumber}</Link>
                    {overdueDays != null ? <StatusBadge tone="danger" className="shrink-0">{overdueDays}d overdue</StatusBadge> : <span className="text-emerald-600">On time</span>}
                  </div>
                  <p className="text-[0.8125rem] font-medium text-[var(--ink)]">{bill.supplier.name}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-[0.75rem]">
                    <span className="font-semibold text-red-700 dark:text-red-400">{formatMoneyCompact(balance, currency)} due</span>
                    {bill.dueAt && <span className="text-[var(--ink-muted)]">{new Date(bill.dueAt).toLocaleDateString()}</span>}
                    {canBillPdf ? <a href={`/api/procurement/documents/supplier-bill/${bill.id}`} target="_blank" rel="noreferrer" className="font-semibold text-[var(--ink-muted)] underline">PDF</a> : null}
                  </div>
                  {/* Inline pay — same action as the Payables tab, routed back here. */}
                  <form action={paySupplierBillAction} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="billId" value={bill.id} />
                    <input type="hidden" name="section" value="bills" />
                    <input name="amount" required type="number" min="0.01" step="0.01" max={balance} defaultValue={String(balance)} placeholder="Amt" className="h-8 w-20 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none focus:border-emerald-500/50" />
                    <select name="method" defaultValue="CASH" className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none">
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
                    </select>
                    <SubmitButton bare pendingLabel="…" className="h-8 rounded-lg bg-emerald-600 px-2.5 text-[0.75rem] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">Pay</SubmitButton>
                  </form>
                </div>
              );
            }}
            columns={[
              {
                key: "bill",
                header: "Bill #",
                className: "font-semibold",
                cell: (bill) => (
                  <Link href={`/inventory/supplier-bills/${bill.id}`} className="hover:text-[var(--accent)] transition-colors">
                    {bill.billNumber}
                  </Link>
                ),
              },
              { key: "supplier", header: "Supplier", cell: (bill) => bill.supplier.name },
              {
                key: "status",
                header: "Status",
                cell: (bill) => (
                  <StatusBadge tone={bill.status === "PART_PAID" ? "warning" : "neutral"}>
                    {bill.status === "PART_PAID" ? "Part paid" : "Posted"}
                  </StatusBadge>
                ),
              },
              { key: "total", header: "Total", className: "whitespace-nowrap tabular-nums", cell: (bill) => formatMoneyCompact(bill.totalAmount, currency) },
              {
                key: "paid",
                header: "Paid",
                className: "whitespace-nowrap tabular-nums",
                cell: (bill) => bill.paidAmount > 0
                  ? <span className="text-emerald-700 dark:text-emerald-400">{formatMoneyCompact(bill.paidAmount, currency)}</span>
                  : <span className="text-[var(--ink-muted)]">—</span>,
              },
              { key: "balance", header: "Balance", className: "font-semibold text-red-700 dark:text-red-400 whitespace-nowrap tabular-nums", cell: (bill) => formatMoneyCompact(bill.totalAmount - bill.paidAmount, currency) },
              { key: "due", header: "Due", className: "text-[0.75rem] text-[var(--ink-muted)]", cell: (bill) => bill.dueAt ? new Date(bill.dueAt).toLocaleDateString() : "—" },
              {
                key: "overdue",
                header: "Overdue",
                cell: (bill) => {
                  const overdueDays = daysOverdue(bill.dueAt);
                  return overdueDays != null
                    ? <StatusBadge tone="danger">{overdueDays}d overdue</StatusBadge>
                    : <span className="text-[var(--ink-muted)] text-[0.75rem]">On time</span>;
                },
              },
            ]}
            actions={(bill) => {
              const balance = bill.totalAmount - bill.paidAmount;
              return (
                <>
                  <form action={paySupplierBillAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="billId" value={bill.id} />
                    <input type="hidden" name="section" value="bills" />
                    <input name="amount" required type="number" min="0.01" step="0.01" max={balance} defaultValue={String(balance)} placeholder="Amt" className="h-8 w-20 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none focus:border-emerald-500/50" />
                    <select name="method" defaultValue="CASH" className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none">
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
                    </select>
                    <SubmitButton bare pendingLabel="…" className="h-8 rounded-lg bg-emerald-600 px-2.5 text-[0.75rem] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">Pay</SubmitButton>
                  </form>
                  {canBillPdf ? <a href={`/api/procurement/documents/supplier-bill/${bill.id}`} target="_blank" rel="noreferrer" className="h-8 inline-flex items-center rounded-lg border border-[var(--line)] px-2 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">PDF</a> : null}
                  <Link href={`/inventory/supplier-bills/${bill.id}`} className="btn-premium-secondary rounded-lg px-3 py-1.5">
                    Open
                  </Link>
                </>
              );
            }}
          />
        </section>
      )}

      {/* ── Section 3: External Tech Payouts ───────────────────────────────── */}
      {activeTab === "tech" && canSeeRepairs && (
        <section id="tech" className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400" />
            <p className="text-sm font-semibold text-[var(--ink)]">External Tech Payouts — Pending</p>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[0.75rem] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
              {techTotal}
            </span>
          </div>
          <DataTable
            rows={techRows}
            getRowKey={(job) => job.id}
            className="panel-shadow"
            empty={filters.q || filters.tech ? "No results for these filters." : "No pending external tech payouts — all settled."}
            renderMobileCard={(job) => {
              const payoutDue = resolveTechCost(job.externalTechFee, job.externalTechBill);
              const alreadyPaid = paidToTechnician(job.id);
              const remaining = remainingTechnicianPayout(job);
              const doneAt = job.deliveredAt ?? job.completedAt;
              return (
                <div className="px-4 py-3">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <Link href={`/jobs/${job.id}?tab=financials&returnTo=/payables&returnLabel=Payables`} className="mono text-[0.8125rem] font-bold text-[var(--accent)]">{job.jobNumber}</Link>
                    <span className="text-[0.75rem] font-semibold text-blue-700 dark:text-blue-400">{formatMoneyCompact(remaining, currency)} due</span>
                  </div>
                  <p className="font-medium text-[var(--ink)]">{clientDisplayName(job.client, "—")} <span className="font-normal text-[var(--ink-muted)]">{job.client?.phone}</span></p>
                  <p className="mt-0.5 text-[var(--ink-muted)]">
                    {job.assignedTo?.name ?? "Unassigned"}{doneAt ? ` · ${new Date(doneAt).toLocaleDateString()}` : ""}
                    {alreadyPaid > 0 ? ` · Paid ${formatMoneyCompact(alreadyPaid, currency)} of ${formatMoneyCompact(payoutDue, currency)}` : ""}
                    {canJobCard ? <>{` · `}<a href={`/api/jobs/${job.id}/job-card`} target="_blank" rel="noreferrer" className="font-semibold underline">Job card PDF</a></> : null}
                  </p>
                  {/* Mark Paid action */}
                  <form action={markExternalTechPaid} className="mt-2">
                    <input type="hidden" name="jobId" value={job.id} />
                    <ConfirmSubmitButton
                      message={`Record a payout of ${formatMoneyCompact(remaining, currency)} to this technician? This can't be undone.`}
                      confirmLabel="Mark paid"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[0.8125rem] font-bold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                      Mark Paid — {formatMoneyCompact(remaining, currency)}
                    </ConfirmSubmitButton>
                  </form>
                </div>
              );
            }}
            columns={[
              {
                key: "job",
                header: "Job",
                className: "font-semibold",
                cell: (job) => <Link href={`/jobs/${job.id}?tab=financials&returnTo=/payables&returnLabel=Payables`} className="hover:text-[var(--accent)] transition-colors">{job.jobNumber}</Link>,
              },
              {
                key: "client",
                header: "Client",
                cell: (job) => <><p className="font-medium">{clientDisplayName(job.client, "—")}</p><p className="text-[0.75rem] text-[var(--ink-muted)]">{job.client?.phone ?? "—"}</p></>,
              },
              { key: "technician", header: "Technician", cell: (job) => job.assignedTo?.name ?? "Unassigned" },
              { key: "status", header: "Status", cell: (job) => job.status },
              { key: "clientBill", header: "Client Bill", className: "whitespace-nowrap tabular-nums", cell: (job) => (typeof job.clientBill === "number" ? formatMoneyCompact(job.clientBill, currency) : "—") },
              {
                key: "payoutDue",
                header: "Payout Due",
                className: "font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap tabular-nums",
                cell: (job) => {
                  const payoutDue = resolveTechCost(job.externalTechFee, job.externalTechBill);
                  const alreadyPaid = paidToTechnician(job.id);
                  const remaining = remainingTechnicianPayout(job);
                  return (
                    <>
                      <p>{formatMoneyCompact(remaining, currency)}</p>
                      {alreadyPaid > 0 ? <p className="text-[0.75rem] font-medium text-[var(--ink-muted)]">Paid {formatMoneyCompact(alreadyPaid, currency)} / {formatMoneyCompact(payoutDue, currency)}</p> : null}
                    </>
                  );
                },
              },
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
              <>
                {/* Mark Paid directly on this page */}
                <form action={markExternalTechPaid}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <ConfirmSubmitButton
                    message="Record this technician payout? This can't be undone."
                    confirmLabel="Mark paid"
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 font-bold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                    Mark Paid
                  </ConfirmSubmitButton>
                </form>
                {canJobCard ? <a href={`/api/jobs/${job.id}/job-card`} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">Job card</a> : null}
                <Link href={`/jobs/${job.id}?tab=financials&returnTo=/payables&returnLabel=Payables`} className="btn-premium-secondary rounded-lg px-2.5 py-1.5">Open</Link>
              </>
            )}
          />
        </section>
      )}

      {/* ── Section 1: Payables ────────────────────────────────────────────── */}
      {activeTab === "payables" && canSeePayables && (
        <section id="payables" className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400" />
            <p className="text-sm font-semibold text-[var(--ink)]">Payables</p>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[0.75rem] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
              {bucketedRows.length}
            </span>
            <span className="text-[0.75rem] font-semibold text-rose-700 dark:text-rose-400">
              {formatMoneyCompact(bucketedRows.reduce((s, r) => s + toBase(r.balance, r.currency, null), 0), currency)} in view
            </span>
          </div>

          {/* Largest balances first — sets the search to that creditor. */}
          {topCreditors.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topCreditors.map((c) => (
                <Link
                  key={c.name}
                  href={`?section=payables${filters.q ? "" : `&q=${encodeURIComponent(c.name)}`}`}
                  title={`${c.count} open item${c.count !== 1 ? "s" : ""}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[0.75rem] font-medium text-[var(--ink-muted)] transition hover:border-rose-400/50 hover:text-[var(--ink)]"
                >
                  {c.name}
                  <span className="font-bold tabular-nums text-rose-700 dark:text-rose-400">{formatMoneyCompact(c.base, currency)}</span>
                </Link>
              ))}
            </div>
          ) : null}

          {/* Maturity buckets mirror the invoice collections. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { label: "All", value: "all" },
              { label: "Current", value: "current" },
              { label: "1–30d", value: "d30" },
              { label: "31–60d", value: "d60" },
              { label: "61d+", value: "d61" },
            ] as const).map(({ label, value }) => {
              const p = new URLSearchParams();
              if (filters.q) p.set("q", filters.q);
              if (filters.tech) p.set("tech", filters.tech);
              p.set("section", "payables");
              if (value !== "all") p.set("bucket", value);
              const active = bucketFilter === value;
              return (
                <Link
                  key={value}
                  href={`?${p.toString()}`}
                  className={`rounded-full border px-2.5 py-1 text-[0.75rem] font-semibold transition ${active ? "border-rose-400/60 bg-rose-500/10 text-rose-700 dark:text-rose-400" : "border-[var(--line)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
                >
                  {label}
                </Link>
              );
            })}
            {bucketFilter !== "all" && bucketedRows.length > 0 ? (
              <form action={payBucketAction} className="ml-auto flex items-center gap-1.5">
                <input type="hidden" name="bucket" value={bucketFilter} />
                <select name="method" defaultValue="CASH" aria-label="Payment method" className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none">
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
                </select>
                <ConfirmSubmitButton
                  message={`Pay all ${bucketedRows.length} item${bucketedRows.length !== 1 ? "s" : ""} in this bucket? This moves real money and can't be undone.`}
                  confirmLabel={`Pay ${bucketedRows.length}`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[0.75rem] font-bold text-white transition hover:bg-emerald-700"
                >
                  Pay bucket
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div>

          <DataTable
            rows={pagedPayablesRows}
            getRowKey={(r) => `${r.kind}-${r.id}`}
            className="panel-shadow"
            empty={filters.q || bucketFilter !== "all" ? "No payables match these filters." : "Nothing owed — all settled."}
            renderMobileCard={(r) => (
              <div className="px-4 py-3">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-[0.8125rem] font-bold text-[var(--ink)]">{r.creditor}</p>
                  <span className="shrink-0 text-[0.75rem] font-semibold text-rose-700 dark:text-rose-400">{formatMoneyCompact(r.balance, r.currency)} due</span>
                </div>
                <p className="text-[0.75rem] text-[var(--ink-muted)]">{r.kind === "BILL" ? "Bill" : r.kind === "EXPENSE" ? "Expense" : "Tech payout"} · {r.ref} · {r.ageLabel}</p>
                <div className="mt-2"><PayablesRowPay r={r} /></div>
              </div>
            )}
            columns={[
              { key: "creditor", header: "Creditor", className: "font-semibold", cell: (r) => r.creditor },
              {
                key: "type", header: "Type",
                cell: (r) => (
                  <StatusBadge tone={r.kind === "BILL" ? "violet" : r.kind === "EXPENSE" ? "warning" : "info"}>
                    {r.kind === "BILL" ? "Bill" : r.kind === "EXPENSE" ? "Expense" : "Tech"}
                  </StatusBadge>
                ),
              },
              { key: "ref", header: "Ref", className: "mono text-[0.75rem]", cell: (r) => r.ref },
              { key: "detail", header: "Detail", className: "max-w-[200px] truncate text-[var(--ink-muted)]", cell: (r) => r.detail },
              { key: "balance", header: "Balance", className: "font-semibold text-rose-700 dark:text-rose-400 whitespace-nowrap tabular-nums", cell: (r) => `${formatMoneyCompact(r.balance, r.currency)}` },
              {
                key: "age", header: "Maturity",
                cell: (r) => r.ageDays > 60
                  ? <StatusBadge tone="danger">{r.ageLabel}</StatusBadge>
                  : r.ageDays > 30
                    ? <StatusBadge tone="warning">{r.ageLabel}</StatusBadge>
                    : <span className="text-[0.75rem] text-[var(--ink-muted)]">{r.ageLabel}</span>,
              },
            ]}
            actions={(r) => (
              <>
                <PayablesRowPay r={r} />
                {r.kind === "BILL" ? (
                  <>
                    {canBillPdf ? <a href={`/api/procurement/documents/supplier-bill/${r.id}`} target="_blank" rel="noreferrer" className="h-8 inline-flex items-center rounded-lg border border-[var(--line)] px-2 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">PDF</a> : null}
                    <Link href={`/inventory/supplier-bills/${r.id}`} className="h-8 inline-flex items-center rounded-lg border border-[var(--line)] px-2 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">Open</Link>
                  </>
                ) : r.kind === "TECH" ? (
                  <>
                    {canJobCard ? <a href={`/api/jobs/${r.id}/job-card`} target="_blank" rel="noreferrer" className="h-8 inline-flex items-center rounded-lg border border-[var(--line)] px-2 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">Job card</a> : null}
                    <Link href={`/jobs/${r.id}?tab=financials&returnTo=/payables&returnLabel=Payables`} className="h-8 inline-flex items-center rounded-lg border border-[var(--line)] px-2 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">Open</Link>
                  </>
                ) : (
                  <Link href="/finance/expenses?status=unpaid" className="h-8 inline-flex items-center rounded-lg border border-[var(--line)] px-2 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">Open</Link>
                )}
              </>
            )}
          />
          {(payBillRows.length >= 200 || payExpenseRows.length >= 200 || payTechRows.length >= 200) ? (
            <p className="text-[0.75rem] text-[var(--ink-muted)]">Showing the 200 oldest per source — narrow by search or bucket to see the rest.</p>
          ) : null}
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
