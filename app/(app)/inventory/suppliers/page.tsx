// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { orgDb } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getCurrentUserRole } from "@/lib/session";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getCurrentUserRole();
  const db = orgDb(user.orgId);
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const page = parsePage(params.page);

  const now = new Date();

  const [suppliers, suppliersTotal, totalActive, outstandingBills, overdueBills] = await Promise.all([
    db.supplier.findMany({
      where: {},
      orderBy: { name: "asc" },
      include: { _count: { select: { purchaseOrders: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.supplier.count({ where: {} }).catch(() => 0),
    db.supplier.count({ where: { isActive: true } }).catch(() => 0),
    db.supplierBill.count({ where: { status: { in: ["POSTED", "PART_PAID"] } } }).catch(() => 0),
    db.supplierBill.count({ where: { dueAt: { lt: now }, status: { notIn: ["PAID", "CANCELLED"] } } }).catch(() => 0),
  ]);

  const pageView = paginationView(page, suppliersTotal);
  const hrefForPage = pageHrefBuilder("/inventory/suppliers", {});

  return (
    <ListPageLayout
      header={{
        eyebrow: "Inventory",
        title: "Suppliers",
        description: `${suppliersTotal} registered`,
        actions: (
          <>
            <Link href="/inventory" className="inline-flex items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
              ← Inventory
            </Link>
            <Link href="/inventory/suppliers/new" className="btn-premium rounded-lg px-3 py-1.5 text-[12px]">
              Add Supplier
            </Link>
          </>
        ),
        kpis: [
          { label: "Total Suppliers", value: suppliersTotal, sub: "registered" },
          { label: "Active", value: totalActive, sub: "currently active", valueClass: "text-green-600" },
          { label: "Outstanding Bills", value: outstandingBills, sub: "posted or part-paid", valueClass: "text-amber-600" },
          { label: "Overdue Bills", value: overdueBills, sub: "past due date", valueClass: "text-red-500" },
        ],
      }}
    >
      <DataTable
        rows={suppliers}
        getRowKey={(s) => s.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total: suppliersTotal, hrefForPage, unit: "suppliers" }}
        empty="No suppliers yet. Add your first supplier to start raising purchase orders."
        columns={[
          {
            key: "name",
            header: "Name",
            className: "font-semibold text-[var(--ink)]",
            cell: (s) => s.name,
          },
          {
            key: "contact",
            header: "Contact",
            headerClassName: "hidden sm:table-cell",
            className: "hidden text-[var(--ink-muted)] sm:table-cell",
            cell: (s) => s.contactName ?? "—",
          },
          {
            key: "phone",
            header: "Phone",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[var(--ink-muted)] md:table-cell",
            cell: (s) => s.phone ?? "—",
          },
          {
            key: "pos",
            header: "POs",
            align: "center",
            className: "text-[var(--ink-muted)]",
            cell: (s) => s._count.purchaseOrders,
          },
          {
            key: "status",
            header: "Status",
            cell: (s) => (
              <StatusBadge tone={s.isActive ? "success" : "neutral"}>
                {s.isActive ? "Active" : "Inactive"}
              </StatusBadge>
            ),
          },
        ]}
        actions={(s) => (
          <Link href={`/inventory/suppliers/${s.id}`} className="inline-flex items-center rounded-lg border border-[var(--line)] px-2.5 py-1.5 font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
            View
          </Link>
        )}
      />
    </ListPageLayout>
  );
}
