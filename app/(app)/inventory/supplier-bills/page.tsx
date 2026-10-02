import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { icontains } from "@/lib/db/search";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { HubTabs } from "@/components/shared/HubTabs";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import {PAGE_SIZE, parsePage, paginationView, pageHrefBuilder, parsePageSize, sizeHrefBuilder} from "@/lib/pagination";
import { createSupplierPaymentAction } from "./actions";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";

import { SubmitButton } from "@/components/ui/SubmitButton";
export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  POSTED: "sky",
  PART_PAID: "warning",
  PAID: "success",
  CANCELLED: "danger",
};

export default async function SupplierBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; error?: string; q?: string; status?: string; sort?: string }>;
}) {
  const { user, orgId, org } = await requireOrgSession();
  // The currency the books are kept in. The payment form asks for the transfer
  // figures in this, since that is what the bank statement shows.
  const baseCurrency = org.baseCurrency ?? "UGX";
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);
  const q = (params.q ?? "").trim();
  const statusFilter = (params.status ?? "all").trim().toLowerCase();
  const sort = params.sort === "due" ? "due" : "newest";

  const now = new Date();
  const where = {
    orgId,
    ...(statusFilter === "overdue"
      ? { dueAt: { lt: now }, status: { notIn: ["PAID", "CANCELLED"] as never } }
      : statusFilter !== "all" && ["draft", "posted", "part_paid", "paid", "cancelled"].includes(statusFilter)
        ? { status: statusFilter.toUpperCase() as never }
        : {}),
    ...(q
      ? {
          OR: [
            { billNumber: icontains(q) },
            { supplierRef: icontains(q) },
            { supplier: { name: icontains(q) } },
          ],
        }
      : {}),
  };
  const orderBy =
    sort === "due" ? { dueAt: "asc" as const } : { issuedAt: "desc" as const };

  const [total, bills, outstandingRows, overdueCount] = await Promise.all([
    prisma.supplierBill.count({ where }).catch(() => 0),
    prisma.supplierBill.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        po: { select: { id: true, reference: true } },
        grn: { select: { id: true, grnNumber: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }).catch(() => []),
    // Outstanding is a per-row Math.max sum (not SQL-aggregatable); keep a slim
    // whole-dataset fetch so the KPI stays correct after the list is paginated.
    prisma.supplierBill.findMany({
      where: { orgId, status: { not: "CANCELLED" } },
      select: { totalAmount: true, paidAmount: true },
    }).catch(() => [] as { totalAmount: number; paidAmount: number }[]),
    prisma.supplierBill.count({ where: { orgId, dueAt: { lt: now }, status: { notIn: ["PAID", "CANCELLED"] } } }).catch(() => 0),
  ]);

  const totalOutstanding = outstandingRows
    .reduce((sum, bill) => sum + Math.max(0, bill.totalAmount - bill.paidAmount), 0);

  const pageView = paginationView(page, total, pageSize);
  const billsHrefFilters = {
    q: q || "",
    status: statusFilter !== "all" ? statusFilter : "",
    sort: sort !== "newest" ? sort : "",
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const billsHref = pageHrefBuilder("/inventory/supplier-bills", billsHrefFilters);
  const billsHrefSize = sizeHrefBuilder("/inventory/supplier-bills", billsHrefFilters);

  const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";

  return (
    <ListPageLayout
      topBar={
        <>
          <HubTabs items={INVENTORY_TABS} />
          <FormErrorBanner message={params.error} />
        </>
      }
      header={{
        title: "Supplier Bills",
        actions: (
          <>
            <Link href="/api/procurement/export?type=supplier-bills" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">Export CSV</Link>
            <Link href="/inventory/supplier-bills/new" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]">New Bill</Link>
          </>
        ),
        kpis: [
          { label: "Total Bills", value: total, sub: "recorded" },
          // valueClass was hand-colouring the figure amber — colour with no
          // word and no rail, which is the thing tones exist to do properly.
          { label: "Outstanding", value: totalOutstanding.toLocaleString(), sub: "posted or part-paid", tone: totalOutstanding > 0 ? "warn" as const : "good" as const, muted: totalOutstanding === 0 },
          { label: "Overdue", value: overdueCount, sub: "past due", tone: overdueCount > 0 ? "crit" as const : "good" as const, muted: overdueCount === 0, href: "/inventory/supplier-bills?status=overdue" },
        ],
      }}
      filters={
        <>
          {overdueCount > 0 && statusFilter !== "overdue" ? (
            <Link href="/inventory/supplier-bills?status=overdue" className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-2.5 text-[0.8125rem] text-[var(--ink-muted)] transition hover:text-[var(--ink)]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
              <span><span className="font-semibold text-[var(--ink)]">{overdueCount} overdue bill{overdueCount === 1 ? "" : "s"}</span> past due date — review →</span>
            </Link>
          ) : null}
          <form method="GET" action="/inventory/supplier-bills" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all", label: "All" },
                { key: "posted", label: "Posted" },
                { key: "part_paid", label: "Part-paid" },
                { key: "paid", label: "Paid" },
                { key: "overdue", label: "Overdue" },
              ].map((s) => (
                <Link
                  key={s.key}
                  href={`/inventory/supplier-bills?status=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${sort !== "newest" ? `&sort=${sort}` : ""}`}
                  className={`rounded-full px-3 py-1 text-[0.75rem] font-semibold transition ${
                    statusFilter === s.key
                      ? "border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
            <input type="hidden" name="status" value={statusFilter} />
            <label className="sr-only" htmlFor="bill-search">Search bills</label>
            <input
              id="bill-search"
              name="q"
              defaultValue={q}
              placeholder="Bill #, ref, supplier…"
              className="ml-auto h-8 w-52 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
            />
            <select name="sort" defaultValue={sort} className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.8125rem] text-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50">
              <option value="newest">Newest</option>
              <option value="due">Due first</option>
            </select>
            <button type="submit" className="h-8 rounded-lg border border-[var(--line)] px-3 text-[0.8125rem] font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)]">
              Filter
            </button>
            {q || statusFilter !== "all" || sort !== "newest" ? (
              <Link href="/inventory/supplier-bills" className="h-8 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Reset</Link>
            ) : null}
          </form>
        </>
      }
    >
      <DataTable
        rows={bills}
        getRowKey={(bill) => bill.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total, hrefForPage: billsHref,
            hrefForSize: billsHrefSize, unit: "bills" }}
        empty={
          q || statusFilter !== "all" ? (
            <>No bills match these filters. <Link href="/inventory/supplier-bills" className="text-[var(--accent)] hover:underline">Clear filters</Link></>
          ) : (
            "No supplier bills yet."
          )
        }
        columns={[
          {
            key: "bill",
            header: "Bill",
            cell: (bill) => (
              <>
                <p className="mono font-bold text-[var(--ink)]">{bill.billNumber}</p>
                <p className="text-[0.75rem] text-[var(--ink-muted)]">{fmt(bill.issuedAt)}</p>
              </>
            ),
          },
          {
            key: "supplier",
            header: "Supplier",
            className: "font-medium text-[var(--ink)]",
            cell: (bill) => bill.supplier.name,
          },
          {
            key: "status",
            header: "Status",
            cell: (bill) => (
              <StatusBadge tone={toneFor(STATUS_TONES, bill.status, "sky")}>{bill.status}</StatusBadge>
            ),
          },
          {
            key: "linked",
            header: "Linked Doc",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[0.75rem] text-[var(--ink-muted)] md:table-cell",
            cell: (bill) => bill.grn ? bill.grn.grnNumber : bill.po ? bill.po.reference ?? `PO-${bill.po.id.slice(-6).toUpperCase()}` : "-",
          },
          {
            key: "total",
            header: "Total",
            align: "right",
            className: "whitespace-nowrap font-semibold tabular-nums text-[var(--ink)]",
            cell: (bill) => `${bill.currency} ${bill.totalAmount.toLocaleString()}`,
          },
          {
            key: "balance",
            header: "Balance",
            align: "right",
            headerClassName: "hidden sm:table-cell",
            className: "hidden whitespace-nowrap tabular-nums text-[var(--ink-muted)] sm:table-cell",
            cell: (bill) => (bill.totalAmount - bill.paidAmount).toLocaleString(),
          },
          {
            key: "due",
            header: "Due",
            align: "right",
            headerClassName: "hidden sm:table-cell",
            className: "hidden whitespace-nowrap text-[var(--ink-muted)] sm:table-cell",
            cell: (bill) => fmt(bill.dueAt),
          },
        ]}
        renderMobileCard={(bill) => (
          <Link href={`/inventory/supplier-bills/${bill.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:opacity-70">
            <div className="min-w-0">
              <p className="mono truncate font-bold text-[var(--ink)]">{bill.billNumber}</p>
              <p className="mt-0.5 truncate text-[var(--ink-muted)]">{bill.supplier.name} · {bill.currency} {bill.totalAmount.toLocaleString()} · bal {(bill.totalAmount - bill.paidAmount).toLocaleString()}</p>
            </div>
            <StatusBadge tone={toneFor(STATUS_TONES, bill.status, "sky")}>{bill.status}</StatusBadge>
          </Link>
        )}
        actions={(bill) => {
          const balance = bill.totalAmount - bill.paidAmount;
          const payable = balance > 0 && bill.status !== "CANCELLED";
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Link href={`/inventory/supplier-bills/${bill.id}`} className="inline-flex items-center rounded-lg border border-[var(--line)] px-2.5 py-1.5 font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">View</Link>
              {payable ? (
                <RowActionsMenu label={`Record payment for ${bill.billNumber}`}>
                  <div className="w-72 p-3">
                    <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]/70">Record payment</p>
                    <p className="mb-2 text-[0.75rem] text-[var(--ink-muted)]">Balance <span className="whitespace-nowrap tabular-nums font-semibold text-[var(--ink)]">{bill.currency} {balance.toLocaleString()}</span></p>
                    <form action={createSupplierPaymentAction} className="grid gap-2 text-left">
                      <input type="hidden" name="billId" value={bill.id} />
                      <input name="amount" type="number" min={0.01} max={balance} step={0.01} placeholder={`Amount (max ${balance.toLocaleString()})`} required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-right text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
                      <select name="method" defaultValue="BANK_TRANSFER" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60">
                        <option value="CASH">Cash</option>
                        <option value="MOBILE_MONEY">Mobile money</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="CARD">Card</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
                      <input name="reference" placeholder="Reference" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
                      {/* Only for a bill in another currency. The rate is not
                          typed: it is derived from what the statement shows, so
                          the books carry the spread that was actually paid
                          rather than a rate nobody transacted at. */}
                      {bill.currency !== baseCurrency ? (
                        <>
                          <input name="baseAmountSent" type="number" min={0} step="any" placeholder={`Total ${baseCurrency} that left the account`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-right text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
                          <input name="feeAmount" type="number" min={0} step="any" placeholder={`Transfer charge in ${baseCurrency}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-right text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
                        </>
                      ) : (
                        <input name="feeAmount" type="number" min={0} step="any" placeholder="Transfer charge (optional)" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-right text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
                      )}
                      <SubmitButton bare className="btn-premium rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold">Record payment</SubmitButton>
                    </form>
                  </div>
                </RowActionsMenu>
              ) : null}
            </div>
          );
        }}
      />
    </ListPageLayout>
  );
}
