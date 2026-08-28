import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
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
  searchParams: Promise<{ page?: string; size?: string; error?: string }>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);

  const [total, bills, outstandingRows] = await Promise.all([
    prisma.supplierBill.count({ where: { orgId } }).catch(() => 0),
    prisma.supplierBill.findMany({
      where: { orgId },
      include: {
        supplier: { select: { name: true } },
        po: { select: { id: true, reference: true } },
        grn: { select: { id: true, grnNumber: true } },
      },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }).catch(() => []),
    // Outstanding is a per-row Math.max sum (not SQL-aggregatable); keep a slim
    // whole-dataset fetch so the KPI stays correct after the list is paginated.
    prisma.supplierBill.findMany({
      where: { orgId, status: { not: "CANCELLED" } },
      select: { totalAmount: true, paidAmount: true },
    }).catch(() => [] as { totalAmount: number; paidAmount: number }[]),
  ]);

  const totalOutstanding = outstandingRows
    .reduce((sum, bill) => sum + Math.max(0, bill.totalAmount - bill.paidAmount), 0);

  const pageView = paginationView(page, total, pageSize);
  const billsHrefFilters = {
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const billsHref = pageHrefBuilder("/inventory/supplier-bills", billsHrefFilters);
  const billsHrefSize = sizeHrefBuilder("/inventory/supplier-bills", billsHrefFilters);

  const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";

  return (
    <ListPageLayout
      topBar={<FormErrorBanner message={params.error} />}
      header={{
        eyebrow: "Procurement",
        title: "Supplier Bills",
        actions: (
          <>
            <Link href="/api/procurement/export?type=supplier-bills" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">Export CSV</Link>
            <Link href="/inventory/supplier-bills/new" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]">New Bill</Link>
          </>
        ),
        kpis: [
          { label: "Total Bills", value: total, sub: "recorded" },
          { label: "Outstanding", value: totalOutstanding.toLocaleString(), sub: "posted or part-paid", valueClass: "text-amber-600" },
        ],
      }}
    >
      <DataTable
        rows={bills}
        getRowKey={(bill) => bill.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total, hrefForPage: billsHref,
            hrefForSize: billsHrefSize, unit: "bills" }}
        empty="No supplier bills yet."
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
