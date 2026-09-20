import { redirect } from "next/navigation";
import Link from "next/link";

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
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder, parsePageSize, sizeHrefBuilder } from "@/lib/pagination";
import { icontains } from "@/lib/db/search";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  approveStockTransferAction,
  cancelStockTransferAction,
  createLocationForTransferAction,
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
  const createdFlag = String(params.created ?? "");
  const created = createdFlag === "1";
  const locationCreated = createdFlag === "location";
  const error = typeof params.error === "string" ? params.error : "";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);
  const q = String(params.q ?? "").trim();
  const statusFilter = String(params.status ?? "all").trim().toLowerCase();
  const sort = params.sort === "oldest" ? "oldest" : "newest";

  const where = {
    orgId,
    ...(statusFilter === "open"
      ? { status: { in: ["REQUESTED", "APPROVED", "DISPATCHED"] as never } }
      : statusFilter !== "all" && ["requested", "approved", "dispatched", "received", "cancelled"].includes(statusFilter)
        ? { status: statusFilter.toUpperCase() as never }
        : {}),
    ...(q
      ? {
          OR: [
            { transferNumber: icontains(q) },
            { note: icontains(q) },
          ],
        }
      : {}),
  };
  const orderBy = sort === "oldest" ? { createdAt: "asc" as const } : { createdAt: "desc" as const };

  const [transfers, transfersTotal, locations, parts] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      orderBy,
      include: { items: { include: { part: { select: { sku: true, name: true } } } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }).catch(() => []),
    prisma.stockTransfer.count({ where }).catch(() => 0),
    prisma.stockLocation.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.part.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true } }),
  ]);
  const [pendingTransfers, inTransitTransfers] = await Promise.all([
    prisma.stockTransfer.count({ where: { orgId, status: { in: ["REQUESTED", "APPROVED"] } } }).catch(() => 0),
    prisma.stockTransfer.count({ where: { orgId, status: "DISPATCHED" } }).catch(() => 0),
  ]);
  const locationName = new Map(locations.map((location) => [location.id, location.name]));
  const pageView = paginationView(page, transfersTotal, pageSize);
  const hrefForPageFilters = { q: q || "", status: statusFilter !== "all" ? statusFilter : "", sort: sort !== "newest" ? sort : "", size: pageSize !== PAGE_SIZE ? pageSize : "" };
  const hrefForPage = pageHrefBuilder("/inventory/transfers", hrefForPageFilters);
  const hrefForPageSize = sizeHrefBuilder("/inventory/transfers", hrefForPageFilters);

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
          {locationCreated ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">Location added. Add one more, then you can move stock between them.</div> : null}
          {error ? <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div> : null}

          <form method="GET" action="/inventory/transfers" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all", label: "All" },
                { key: "open", label: "Open" },
                { key: "dispatched", label: "In transit" },
                { key: "received", label: "Received" },
                { key: "cancelled", label: "Cancelled" },
              ].map((s) => (
                <Link
                  key={s.key}
                  href={`/inventory/transfers?status=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${sort !== "newest" ? `&sort=${sort}` : ""}`}
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
            <label className="sr-only" htmlFor="transfer-search">Search transfers</label>
            <input
              id="transfer-search"
              name="q"
              defaultValue={q}
              placeholder="Transfer #, note…"
              className="ml-auto h-8 w-52 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
            />
            <select name="sort" defaultValue={sort} className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.8125rem] text-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <button type="submit" className="h-8 rounded-lg border border-[var(--line)] px-3 text-[0.8125rem] font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)]">
              Filter
            </button>
            {q || statusFilter !== "all" || sort !== "newest" ? (
              <Link href="/inventory/transfers" className="h-8 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Reset</Link>
            ) : null}
          </form>

          {locations.length < 2 ? (
            <div className="dc-card px-3 py-2.5">
              <p className="mb-1 text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Add a location</p>
              <p className="mb-2.5 text-[0.8125rem] text-[var(--ink-muted)]">
                A transfer moves stock between two locations, so you need at least two.
                You have {locations.length === 0 ? "none" : "one"} — add {locations.length === 0 ? "a couple" : "one more"} to start transferring.
              </p>
              <form action={createLocationForTransferAction} className="flex flex-wrap gap-2">
                <input name="name" required placeholder="e.g. Main Store, Warehouse B" className="min-w-[12rem] flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
                <SubmitButton bare className="btn-premium rounded-lg px-4 py-1.5 text-[0.8125rem] font-semibold">Add location</SubmitButton>
              </form>
            </div>
          ) : (
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
              <SubmitButton bare className="btn-premium rounded-lg px-4 py-1.5 text-[0.8125rem] font-semibold">Request</SubmitButton>
            </form>
          </div>
          )}
        </>
      }
    >
      <DataTable
        rows={transfers}
        getRowKey={(transfer) => transfer.id}
        pagination={{ page: pageView.page, pageSize, total: transfersTotal, hrefForPage, hrefForSize: hrefForPageSize, unit: "transfers" }}
        empty={
          q || statusFilter !== "all" ? (
            <>No transfers match these filters. <Link href="/inventory/transfers" className="text-[var(--accent)] hover:underline">Clear filters</Link></>
          ) : (
            "No transfer requests yet."
          )
        }
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
