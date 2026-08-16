import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { RowActionsMenu, MenuActionLink } from "@/components/shared/RowActionsMenu";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function GoodsReceivedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const page = parsePage(params.page);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [notes, notesTotal, receivedThisMonth] = await Promise.all([
    prisma.goodsReceived.findMany({
      where: { orgId },
      include: {
        supplier: { select: { name: true } },
        po: { select: { id: true, reference: true } },
        location: { select: { name: true, code: true } },
        items: { select: { quantity: true, unitCost: true } },
      },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }).catch(() => []),
    prisma.goodsReceived.count({ where: { orgId } }).catch(() => 0),
    prisma.goodsReceived.count({ where: { orgId, receivedAt: { gte: monthStart } } }).catch(() => 0),
  ]);

  const pageView = paginationView(page, notesTotal);
  const hrefForPage = pageHrefBuilder("/inventory/goods-received", {});

  const fmt = (d: Date) => d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <ListPageLayout
      header={{
        eyebrow: "Procurement",
        title: "Goods Received",
        kpis: [
          { label: "Total GRNs", value: notesTotal, sub: "received notes" },
          { label: "This Month", value: receivedThisMonth, sub: "received", valueClass: "text-emerald-600" },
        ],
        actions: (
          <>
            <Link href="/api/procurement/export?type=goods-received" className="inline-flex items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
              Export CSV
            </Link>
            <Link href="/inventory/purchase-orders" className="inline-flex items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
              Receive from PO
            </Link>
          </>
        ),
      }}
    >
      <DataTable
        rows={notes}
        getRowKey={(grn) => grn.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total: notesTotal, hrefForPage, unit: "notes" }}
        empty="No goods received yet. Open a purchase order to receive stock."
        columns={[
          {
            key: "grn",
            header: "GRN",
            cell: (grn) => (
              <Link href={`/inventory/goods-received/${grn.id}`} className="font-semibold text-[var(--ink)] hover:text-[var(--accent)]">
                {grn.grnNumber}
              </Link>
            ),
          },
          {
            key: "supplier",
            header: "Supplier",
            className: "text-[var(--ink)]",
            cell: (grn) => grn.supplier.name,
          },
          {
            key: "po",
            header: "PO",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[0.75rem] text-[var(--ink-muted)] md:table-cell",
            cell: (grn) => grn.po ? (
              <Link href={`/inventory/purchase-orders/${grn.po.id}`} className="hover:text-[var(--accent)]">
                {grn.po.reference ?? `PO-${grn.po.id.slice(-6).toUpperCase()}`}
              </Link>
            ) : "—",
          },
          {
            key: "location",
            header: "Location",
            headerClassName: "hidden sm:table-cell",
            className: "hidden text-[0.75rem] text-[var(--ink-muted)] sm:table-cell",
            cell: (grn) => `${grn.location.name}${grn.location.code ? ` (${grn.location.code})` : ""}`,
          },
          {
            key: "value",
            header: "Value",
            align: "right",
            className: "font-semibold tabular-nums text-[var(--ink)]",
            cell: (grn) => grn.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0).toLocaleString(),
          },
          {
            key: "received",
            header: "Received",
            align: "right",
            className: "whitespace-nowrap text-[0.75rem] text-[var(--ink-muted)]",
            cell: (grn) => fmt(grn.receivedAt),
          },
        ]}
        actions={(grn) => (
          <RowActionsMenu label={`GRN ${grn.grnNumber}`}>
            <MenuActionLink href={`/inventory/goods-received/${grn.id}`} icon="open">View</MenuActionLink>
            <MenuActionLink href={`/api/procurement/documents/goods-received/${grn.id}`} external icon="download">Print / PDF</MenuActionLink>
          </RowActionsMenu>
        )}
        renderMobileCard={(grn) => (
          <Link href={`/inventory/goods-received/${grn.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:opacity-70">
            <div className="min-w-0">
              <p className="truncate font-bold text-[var(--ink)]">{grn.grnNumber}</p>
              <p className="mt-0.5 truncate text-[var(--ink-muted)]">{grn.supplier.name} · {fmt(grn.receivedAt)}</p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-[var(--ink)]">{grn.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0).toLocaleString()}</span>
          </Link>
        )}
      />
    </ListPageLayout>
  );
}
