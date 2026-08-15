import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { can } from "@/lib/permissions";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { HubTabs } from "@/components/shared/HubTabs";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { RowActionsMenu, MenuSection, MenuActionButton } from "@/components/shared/RowActionsMenu";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import {
  approveStockTransferAction,
  cancelStockTransferAction,
  createStockTransferAction,
  dispatchStockTransferAction,
  receiveStockTransferAction,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, BadgeTone> = {
  REQUESTED: "sky",
  APPROVED: "warning",
  DISPATCHED: "purple",
  RECEIVED: "success",
  CANCELLED: "neutral",
};

function fmt(d: Date | null) {
  return d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default async function StockTransfersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule(OrgModule.INVENTORY);
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const created = String(params.created ?? "") === "1";
  const error = typeof params.error === "string" ? params.error : "";
  const page = parsePage(params.page);

  const [transfers, transfersTotal, locations, parts] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { part: { select: { sku: true, name: true } } } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }).catch(() => []),
    prisma.stockTransfer.count({ where: { orgId } }).catch(() => 0),
    prisma.stockLocation.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.part.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true } }),
  ]);
  const [pendingTransfers, inTransitTransfers] = await Promise.all([
    prisma.stockTransfer.count({ where: { orgId, status: { in: ["REQUESTED", "APPROVED"] } } }).catch(() => 0),
    prisma.stockTransfer.count({ where: { orgId, status: "DISPATCHED" } }).catch(() => 0),
  ]);
  const locationName = new Map(locations.map((location) => [location.id, location.name]));
  const pageView = paginationView(page, transfersTotal);
  const hrefForPage = pageHrefBuilder("/inventory/transfers", {});

  // Named so the same status actions render in the desktop table AND mobile card.
  const renderTransferActions = (transfer: (typeof transfers)[number]) => {
    const canCancel = transfer.status === "REQUESTED" || transfer.status === "APPROVED";
    const hasAction = transfer.status === "REQUESTED" || transfer.status === "APPROVED" || transfer.status === "DISPATCHED";
    if (!hasAction) return null;
    return (
      <RowActionsMenu label={`Transfer ${transfer.transferNumber}`}>
        {transfer.status === "REQUESTED" ? (
          <form action={approveStockTransferAction}>
            <input type="hidden" name="id" value={transfer.id} />
            <MenuActionButton icon="save" tone="accent">Approve</MenuActionButton>
          </form>
        ) : null}
        {transfer.status === "APPROVED" ? (
          <form action={dispatchStockTransferAction}>
            <input type="hidden" name="id" value={transfer.id} />
            <MenuActionButton icon="delivery">Dispatch</MenuActionButton>
          </form>
        ) : null}
        {transfer.status === "DISPATCHED" ? (
          <form action={receiveStockTransferAction}>
            <input type="hidden" name="id" value={transfer.id} />
            <MenuActionButton icon="receipt" tone="success">Receive</MenuActionButton>
          </form>
        ) : null}
        {canCancel ? (
          <>
            <MenuSection label="Danger zone" />
            <form action={cancelStockTransferAction}>
              <input type="hidden" name="id" value={transfer.id} />
              <MenuActionButton icon="close" tone="danger">Cancel</MenuActionButton>
            </form>
          </>
        ) : null}
      </RowActionsMenu>
    );
  };

  return (
    <ListPageLayout
      topBar={<HubTabs items={INVENTORY_TABS} />}
      header={{
        eyebrow: "Inventory",
        title: "Stock Transfers",
        kpis: [
          { label: "Total", value: transfersTotal, sub: "transfers" },
          { label: "Pending", value: pendingTransfers, sub: "to approve/dispatch", valueClass: pendingTransfers > 0 ? "text-amber-600" : undefined },
          { label: "In Transit", value: inTransitTransfers, sub: "dispatched", valueClass: inTransitTransfers > 0 ? "text-sky-600" : undefined },
        ],
      }}
      filters={
        <>
          {created ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">Transfer requested.</div> : null}
          {error ? <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div> : null}

          <div className="dc-card px-3 py-2.5">
            <p className="mb-2.5 text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Request Transfer</p>
            <form action={createStockTransferAction} className="grid gap-2 lg:grid-cols-[1fr_1fr_1.4fr_0.55fr_1fr_auto]">
              <select name="fromLocationId" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60">
                <option value="">From location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
              <select name="toLocationId" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60">
                <option value="">To location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
              <select name="partId" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60">
                <option value="">Item</option>
                {parts.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
              </select>
              <input name="quantity" placeholder="Qty" inputMode="numeric" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
              <input name="note" placeholder="Note" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
              <button type="submit" className="btn-premium rounded-lg px-4 py-1.5 text-[0.8125rem] font-semibold">Request</button>
            </form>
          </div>
        </>
      }
    >
      <DataTable
        rows={transfers}
        getRowKey={(transfer) => transfer.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total: transfersTotal, hrefForPage, unit: "transfers" }}
        empty="No transfer requests yet."
        columns={[
          {
            key: "transfer",
            header: "Transfer",
            className: "mono font-semibold text-[var(--ink)]",
            cell: (transfer) => transfer.transferNumber,
          },
          {
            key: "route",
            header: "Route",
            className: "text-[var(--ink-muted)]",
            cell: (transfer) => `${locationName.get(transfer.fromLocationId) ?? "From"} → ${locationName.get(transfer.toLocationId) ?? "To"}`,
          },
          {
            key: "item",
            header: "Item",
            className: "text-[var(--ink)]",
            cell: (transfer) => {
              const first = transfer.items[0];
              return first ? `${first.part.name} x${first.quantity}` : "No items";
            },
          },
          {
            key: "status",
            header: "Status",
            cell: (transfer) => (
              <StatusBadge tone={toneFor(STATUS_TONES, transfer.status, "sky")}>{transfer.status.replaceAll("_", " ")}</StatusBadge>
            ),
          },
          {
            key: "date",
            header: "Date",
            headerClassName: "hidden md:table-cell",
            className: "hidden whitespace-nowrap text-[var(--ink-muted)] md:table-cell",
            cell: (transfer) => fmt(transfer.createdAt),
          },
        ]}
        actions={renderTransferActions}
        renderMobileCard={(transfer) => (
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mono truncate font-bold text-[var(--ink)]">{transfer.transferNumber}</p>
                <p className="mt-0.5 truncate text-[var(--ink-muted)]">{locationName.get(transfer.fromLocationId) ?? "From"} → {locationName.get(transfer.toLocationId) ?? "To"}</p>
                <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">{transfer.items[0] ? `${transfer.items[0].part.name} x${transfer.items[0].quantity}` : "No items"} · {fmt(transfer.createdAt)}</p>
              </div>
              <StatusBadge tone={toneFor(STATUS_TONES, transfer.status, "sky")}>{transfer.status.replaceAll("_", " ")}</StatusBadge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.75rem]">{renderTransferActions(transfer)}</div>
          </div>
        )}
      />
    </ListPageLayout>
  );
}
