import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";

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
  searchParams: Promise<{ page?: string }>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = await searchParams;
  const page = parsePage(params.page);

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
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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

  const pageView = paginationView(page, total);
  const billsHref = pageHrefBuilder("/inventory/supplier-bills", {});

  const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";

  return (
    <ListPageLayout
      header={{
        eyebrow: "Inventory",
        title: "Supplier Bills",
        description: `${total} bills · outstanding ${totalOutstanding.toLocaleString()}`,
        actions: (
          <>
            <Link href="/api/procurement/export?type=supplier-bills" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">Export CSV</Link>
            <Link href="/inventory/supplier-bills/new" className="btn-premium rounded-lg px-3 py-1.5 text-[12px]">New Bill</Link>
          </>
        ),
      }}
    >
      <DataTable
        rows={bills}
        getRowKey={(bill) => bill.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total, hrefForPage: billsHref, unit: "bills" }}
        empty="No supplier bills yet."
        columns={[
          {
            key: "bill",
            header: "Bill",
            cell: (bill) => (
              <>
                <p className="mono font-bold text-[var(--ink)]">{bill.billNumber}</p>
                <p className="text-[12px] text-[var(--ink-muted)]">{fmt(bill.issuedAt)}</p>
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
            className: "hidden text-[12px] text-[var(--ink-muted)] md:table-cell",
            cell: (bill) => bill.grn ? bill.grn.grnNumber : bill.po ? bill.po.reference ?? `PO-${bill.po.id.slice(-6).toUpperCase()}` : "-",
          },
          {
            key: "total",
            header: "Total",
            align: "right",
            className: "font-semibold tabular-nums text-[var(--ink)]",
            cell: (bill) => `${bill.currency} ${bill.totalAmount.toLocaleString()}`,
          },
          {
            key: "balance",
            header: "Balance",
            align: "right",
            headerClassName: "hidden sm:table-cell",
            className: "hidden tabular-nums text-[var(--ink-muted)] sm:table-cell",
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
        actions={(bill) => (
          <Link href={`/inventory/supplier-bills/${bill.id}`} className="inline-flex items-center rounded-lg border border-[var(--line)] px-2.5 py-1.5 font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">View</Link>
        )}
      />
    </ListPageLayout>
  );
}
