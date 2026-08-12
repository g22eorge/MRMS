import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { orgDb } from "@/lib/db";
import { createSupplierAction } from "./actions";
import { can } from "@/lib/permissions";
import { getCurrentUserRole } from "@/lib/session";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { HubTabs } from "@/components/shared/HubTabs";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RowActionsMenu, MenuActionLink, MenuSection } from "@/components/shared/RowActionsMenu";
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
      topBar={<HubTabs items={INVENTORY_TABS} />}
      header={{
        eyebrow: "Inventory",
        title: "Suppliers",
        description: `${suppliersTotal} registered`,
        actions: (
          <>
            <Link href="/inventory/suppliers/new" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]">
              Add Supplier
            </Link>
          </>
        ),
        kpis: [
          { label: "Total Suppliers", value: suppliersTotal, sub: "registered" },
          { label: "Active", value: totalActive, sub: "currently active", valueClass: "text-emerald-600" },
          { label: "Outstanding Bills", value: outstandingBills, sub: "posted or part-paid", valueClass: "text-amber-600" },
          { label: "Overdue Bills", value: overdueBills, sub: "past due date", valueClass: "text-red-500" },
        ],
      }}
      filters={
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="mb-2.5 text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Add Supplier</p>
          <form
            action={async (formData: FormData) => {
              "use server";
              await createSupplierAction(formData);
              revalidatePath("/inventory/suppliers");
            }}
            className="grid gap-2 md:grid-cols-[1.3fr_1fr_1fr_0.9fr_1.2fr_auto]"
          >
            <input name="name" placeholder="Supplier name *" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
            <input name="contactName" placeholder="Contact" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
            <input name="email" type="email" placeholder="Email" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
            <input name="phone" placeholder="Phone" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
            <input name="address" placeholder="Address" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
            {/* createSupplierAction reads notes via .trim(); a missing field would be null and throw. */}
            <input type="hidden" name="notes" value="" />
            <button type="submit" className="btn-premium rounded-lg px-4 py-1.5 text-[0.8125rem] font-semibold">Add</button>
          </form>
        </div>
      }
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
          <RowActionsMenu label={`Supplier ${s.name}`}>
            <MenuActionLink href={`/inventory/suppliers/${s.id}`} icon="open">View</MenuActionLink>
            <MenuSection label="Create" />
            <MenuActionLink href={`/inventory/purchase-orders/new?supplierId=${s.id}`} icon="invoice" tone="accent">
              New purchase order
            </MenuActionLink>
            <MenuActionLink href={`/inventory/supplier-bills/new?supplierId=${s.id}`} icon="receipt">
              New bill
            </MenuActionLink>
          </RowActionsMenu>
        )}
        renderMobileCard={(s) => (
          <Link href={`/inventory/suppliers/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:opacity-70">
            <div className="min-w-0">
              <p className="truncate font-bold text-[var(--ink)]">{s.name}</p>
              <p className="mt-0.5 truncate text-[var(--ink-muted)]">
                {s.contactName ?? s.phone ?? "No contact"}
                {s.contactName && s.phone ? <> · {s.phone}</> : null}
                {" · "}{s._count.purchaseOrders} PO{s._count.purchaseOrders === 1 ? "" : "s"}
              </p>
            </div>
            <StatusBadge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</StatusBadge>
          </Link>
        )}
      />
    </ListPageLayout>
  );
}
