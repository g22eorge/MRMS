import Link from "next/link";
import { getCurrentUserRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/currency";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { RowActionsMenu, MenuActionLink, MenuActionButton, MenuSection, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import {PAGE_SIZE, parsePage, paginationView, pageHrefBuilder, parsePageSize, sizeHrefBuilder} from "@/lib/pagination";
import { deletePurchaseOrderAction, setPurchaseOrderStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  ORDERED: "sky",
  PARTIAL: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
};

function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";
}

function poNumber(po: { reference: string | null; id: string }) {
  return po.reference ?? `PO-${po.id.slice(-6).toUpperCase()}`;
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; }>;
}) {
  const { user } = await getCurrentUserRole();
  const orgId = user.orgId;
  if (!orgId) redirect("/login");
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const where = { orgId };
  const [total, orders, pendingItems, openCount, receivingCount, overdueCount, thisMonthCount] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        supplier: { select: { id: true, name: true } },
        items: { select: { qtyOrdered: true, qtyReceived: true, unitCost: true } },
        _count: { select: { goodsReceivedNotes: true, supplierBills: true, purchaseRequests: true } },
      },
    }),
    prisma.purchaseOrderItem.findMany({
      where: { po: { orgId, status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } } },
      select: { qtyOrdered: true, unitCost: true },
    }).catch(() => [] as { qtyOrdered: number; unitCost: number }[]),
    prisma.purchaseOrder.count({ where: { orgId, status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } } }),
    prisma.purchaseOrder.count({ where: { orgId, status: { in: ["ORDERED", "PARTIAL"] } } }),
    prisma.purchaseOrder.count({ where: { orgId, status: { in: ["ORDERED", "PARTIAL"] }, expectedAt: { lt: now } } }),
    prisma.purchaseOrder.count({ where: { orgId, createdAt: { gte: monthStart } } }),
  ]);

  // KPIs stay whole-dataset: counts come from count({ where }) and pendingValue
  // is a simple (non-currency-converted) sum over the full open-item set.
  const pendingValue = pendingItems.reduce((sum, item) => sum + item.qtyOrdered * item.unitCost, 0);
  const pageView = paginationView(page, total, pageSize);
  const poHrefFilters = {
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const poHref = pageHrefBuilder("/inventory/purchase-orders", poHrefFilters);
  const poHrefSize = sizeHrefBuilder("/inventory/purchase-orders", poHrefFilters);

  // Named so the same actions render in the desktop table AND the mobile card.
  const renderPoActions = (po: (typeof orders)[number]) => {
    const receivable = ["ORDERED", "PARTIAL"].includes(po.status);
    return (
      <RowActionsMenu label={`PO ${poNumber(po)}`}>
        <MenuActionLink href={`/inventory/purchase-orders/${po.id}`} icon="open">View</MenuActionLink>
        <MenuActionLink href={`/api/procurement/documents/purchase-order/${po.id}`} external icon="download">Print / PDF</MenuActionLink>
        {po.status === "DRAFT" ? (
          <form action={setPurchaseOrderStatusAction}>
            <input type="hidden" name="id" value={po.id} />
            <input type="hidden" name="status" value="ORDERED" />
            <MenuActionButton icon="delivery" tone="accent">Issue</MenuActionButton>
          </form>
        ) : receivable ? (
          <MenuActionLink href={`/inventory/purchase-orders/${po.id}#receive`} icon="delivery" tone="accent">Receive stock</MenuActionLink>
        ) : null}
        <MenuSection label="Danger zone" />
        <MenuDestructiveRow>
          <form action={deletePurchaseOrderAction}>
            <input type="hidden" name="id" value={po.id} />
            <MenuActionButton icon="delete" tone="danger">Delete</MenuActionButton>
          </form>
        </MenuDestructiveRow>
      </RowActionsMenu>
    );
  };

  return (
    <ListPageLayout
      header={{
        eyebrow: "Procurement",
        title: "Purchase Orders",
        actions: (
          <>
            <Link href="/inventory" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">Inventory</Link>
            <Link href="/api/procurement/export?type=purchase-orders" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">Export CSV</Link>
            <Link href="/inventory/purchase-orders/new" className="btn-premium rounded-lg px-3 py-1.5 text-xs font-semibold">New PO</Link>
          </>
        ),
        kpis: [
          { label: "Total", value: total },
          { label: "Open", value: openCount },
          { label: "Receiving", value: receivingCount },
          { label: "Overdue", value: overdueCount },
          { label: "Pending", value: formatMoney(pendingValue) },
        ],
      }}
      footer={total > 0 ? (
        <p className="px-1 text-right text-xs font-semibold text-[var(--ink-muted)]">Raised this month: {thisMonthCount}</p>
      ) : null}
    >
      <DataTable
        rows={orders}
        getRowKey={(po) => po.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total, hrefForPage: poHref,
            hrefForSize: poHrefSize, unit: "purchase orders" }}
        empty={
          <div className="space-y-3">
            <p>No purchase orders yet.</p>
            <Link href="/inventory/purchase-orders/new" className="inline-flex rounded-md border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-2.5 py-1.5 font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/15">
              Create PO
            </Link>
          </div>
        }
        columns={[
          {
            key: "po",
            header: "PO",
            cell: (po) => (
              <Link href={`/inventory/purchase-orders/${po.id}`} className="mono font-bold text-[var(--ink)] hover:text-[var(--accent)]">{poNumber(po)}</Link>
            ),
          },
          {
            key: "supplier",
            header: "Supplier",
            className: "font-medium text-[var(--ink)]",
            cell: (po) => po.supplier.name,
          },
          {
            key: "status",
            header: "Status",
            cell: (po) => {
              const isOverdue = ["ORDERED", "PARTIAL"].includes(po.status) && po.expectedAt && po.expectedAt < now;
              return (
                <span className="inline-flex items-center gap-1">
                  <StatusBadge tone={toneFor(STATUS_TONES, po.status)}>{po.status}</StatusBadge>
                  {isOverdue ? <StatusBadge tone="danger">Late</StatusBadge> : null}
                </span>
              );
            },
          },
          {
            key: "lines",
            header: "Lines",
            align: "right",
            className: "tabular-nums text-[var(--ink-muted)]",
            cell: (po) => po.items.length,
          },
          {
            key: "received",
            header: "Received",
            align: "right",
            className: "tabular-nums text-[var(--ink-muted)]",
            cell: (po) => {
              const orderedQty = po.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
              const receivedQty = po.items.reduce((sum, item) => sum + item.qtyReceived, 0);
              return `${receivedQty}/${orderedQty}`;
            },
          },
          {
            key: "value",
            header: "Value",
            align: "right",
            className: "font-semibold tabular-nums text-[var(--ink)]",
            cell: (po) => formatMoney(po.items.reduce((sum, item) => sum + item.qtyOrdered * item.unitCost, 0)),
          },
          {
            key: "ordered",
            header: "Ordered",
            className: "whitespace-nowrap text-[var(--ink-muted)]",
            cell: (po) => fmtDate(po.orderedAt),
          },
          {
            key: "expected",
            header: "Expected",
            className: "whitespace-nowrap text-[var(--ink-muted)]",
            cell: (po) => fmtDate(po.expectedAt),
          },
        ]}
        renderMobileCard={(po) => {
          const orderedQty = po.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
          const receivedQty = po.items.reduce((sum, item) => sum + item.qtyReceived, 0);
          const isOverdue = ["ORDERED", "PARTIAL"].includes(po.status) && po.expectedAt && po.expectedAt < now;
          return (
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/inventory/purchase-orders/${po.id}`} className="min-w-0 active:opacity-70">
                  <p className="mono truncate font-bold text-[var(--ink)]">{poNumber(po)}</p>
                  <p className="mt-0.5 truncate text-[var(--ink-muted)]">{po.supplier.name} · {receivedQty}/{orderedQty} received · {formatMoney(po.items.reduce((sum, item) => sum + item.qtyOrdered * item.unitCost, 0))}</p>
                </Link>
                <span className="flex shrink-0 items-center gap-1">
                  <StatusBadge tone={toneFor(STATUS_TONES, po.status)}>{po.status}</StatusBadge>
                  {isOverdue ? <StatusBadge tone="danger">Late</StatusBadge> : null}
                </span>
              </div>
              {/* Actions reachable on mobile (were desktop-table-only). */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.75rem]">{renderPoActions(po)}</div>
            </div>
          );
        }}
        actions={renderPoActions}
      />
    </ListPageLayout>
  );
}
