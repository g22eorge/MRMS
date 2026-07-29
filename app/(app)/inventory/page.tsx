import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { formatMoney } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { can } from "@/lib/permissions";
import { createPartAction } from "./actions";

type StockStatusFilter = "active" | "inactive" | "all";

type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  manufacturer: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  reorderLevel: number;
  unitCost: number | null;
  isActive: boolean;
};

type MovementRow = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: Date;
  part: { id: string; sku: string; name: string };
  createdBy: { name: string | null; email: string } | null;
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule(OrgModule.INVENTORY);
  const { user, orgId } = await requireOrgSession();
  if (!["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "TECHNICIAN_INTERNAL"].includes(user.role)) {
    redirect("/dashboard");
  }

  const params = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const created = String(params.created ?? "") === "1";
  const error = typeof params.error === "string" ? params.error : "";
  const showAdd = String(params.add ?? "") === "1";
  const stockFilter = (params.stock ?? "all") as "all" | "low" | "out";
  const requestedStatus = String(params.status ?? "active");
  const statusFilter: StockStatusFilter = requestedStatus === "inactive" || requestedStatus === "all" ? requestedStatus : "active";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);

  const canManage = can.manageInventory(user);

  const [parts, partStatusCounts, locationCount, openTransfers, openStockCounts, openPurchaseOrders, recentMovements] = await Promise.all([
    prisma.part
      .findMany({
        where: {
          orgId,
          ...(statusFilter === "all" ? {} : { isActive: statusFilter === "active" }),
          ...(q ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }, { manufacturer: { contains: q } }] } : {}),
        },
        select: {
          id: true,
          sku: true,
          name: true,
          manufacturer: true,
          qtyOnHand: true,
          qtyReserved: true,
          reorderLevel: true,
          unitCost: true,
          isActive: true,
        },
        orderBy: [{ qtyOnHand: "asc" }, { name: "asc" }],
      })
      .catch(() => [] as InventoryRow[]),
    prisma.part
      .groupBy({
        by: ["isActive"],
        where: { orgId },
        _count: { _all: true },
      })
      .catch(() => []),
    prisma.stockLocation.count({ where: { orgId, isActive: true } }).catch(() => 0),
    prisma.stockTransfer.count({ where: { orgId, status: { in: ["REQUESTED", "APPROVED", "DISPATCHED"] } } }).catch(() => 0),
    prisma.stockCount.count({ where: { orgId, status: { in: ["DRAFT", "SUBMITTED"] } } }).catch(() => 0),
    prisma.purchaseOrder.count({ where: { orgId, status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } } }).catch(() => 0),
    prisma.partStockTransaction.findMany({
      where: { part: { orgId } },
      include: {
        part: { select: { id: true, sku: true, name: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }).catch(() => [] as MovementRow[]),
  ]);

  const activeParts = parts.filter((p) => p.isActive);
  const activePartCount = partStatusCounts.find((r) => r.isActive)?._count._all ?? 0;
  const inactivePartCount = partStatusCounts.find((r) => !r.isActive)?._count._all ?? 0;
  const totalPartCount = activePartCount + inactivePartCount;

  const lowStock = activeParts.filter((p) => p.qtyOnHand <= p.reorderLevel && p.reorderLevel > 0);
  const outOfStock = activeParts.filter((p) => p.qtyOnHand === 0);
  const totalValue = activeParts.reduce((sum, p) => sum + (p.unitCost ?? 0) * p.qtyOnHand, 0);
  const totalReserved = activeParts.reduce((sum, p) => sum + p.qtyReserved, 0);
  const totalOnHand = activeParts.reduce((sum, p) => sum + p.qtyOnHand, 0);
  const totalAvailable = activeParts.reduce((sum, p) => sum + Math.max(0, p.qtyOnHand - p.qtyReserved), 0);
  const noCostItems = activeParts.filter((p) => p.qtyOnHand > 0 && (p.unitCost == null || p.unitCost <= 0));
  const noReorderItems = activeParts.filter((p) => p.reorderLevel <= 0);
  const overReserved = activeParts.filter((p) => p.qtyReserved > p.qtyOnHand);
  const stockAccuracyRisk = noCostItems.length + noReorderItems.length + overReserved.length;
  const workingCapitalAtRisk = lowStock.reduce((sum, p) => sum + Math.max(0, p.reorderLevel - p.qtyOnHand) * (p.unitCost ?? 0), 0);

  const filteredParts =
    statusFilter === "active" && stockFilter === "low" ? lowStock
    : statusFilter === "active" && stockFilter === "out" ? outOfStock
    : parts;

  // KPIs above are computed from the whole (in-memory filtered) dataset; only the
  // displayed rows are paginated here.
  const pageView = paginationView(page, filteredParts.length);
  const pageRows = filteredParts.slice(pageView.skip, pageView.skip + pageView.take);
  const hrefForPage = pageHrefBuilder("/inventory", {
    status: statusFilter,
    stock: stockFilter !== "all" ? stockFilter : "",
    q,
  });

  return (
    <div className="space-y-4">

      <PageHeader
        eyebrow="Warehouse"
        title="Inventory Control Desk"
        description="Stock health, movements, locations, replenishment, and item controls."
        actions={canManage ? (
          <>
            <Button href="/api/reports/export?type=inventory-stock" external variant="secondary" size="sm">Export</Button>
            <Button href="/inventory/ops" variant="secondary" size="sm">Stock Hub →</Button>
          </>
        ) : undefined}
        kpis={[
          {
            key: "items",
            label: "Active items",
            value: activePartCount,
            sub: `${locationCount} active location${locationCount === 1 ? "" : "s"}`,
            muted: activePartCount === 0,
          },
          {
            key: "low",
            label: "Low stock",
            value: lowStock.length,
            sub: `${outOfStock.length} out · ${formatMoney(workingCapitalAtRisk)} reorder gap`,
            tone: "warn",
            muted: lowStock.length === 0,
          },
          {
            key: "reserved",
            label: "Reserved",
            value: totalReserved,
            sub: `${totalAvailable} available of ${totalOnHand}`,
            muted: totalReserved === 0,
          },
          {
            key: "value",
            label: "Stock value",
            value: formatMoney(totalValue),
            sub: `${stockAccuracyRisk} policy issue${stockAccuracyRisk === 1 ? "" : "s"}`,
            tone: "accent",
            muted: totalValue === 0,
          },
        ]}
      />

      {/* ── Work in flight — the live counts that used to be a whole card ── */}
      {canManage ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { label: "Transfers", count: openTransfers, href: "/inventory/transfers" },
            { label: "Stock counts", count: openStockCounts, href: "/inventory/stock-counts" },
            { label: "Open POs", count: openPurchaseOrders, href: "/inventory/purchase-orders" },
            { label: "Locations", count: locationCount, href: "/inventory/locations" },
          ] as const).map(({ label, count, href }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
            >
              {label}
              <span className="tabular-nums text-[var(--ink)]">{count}</span>
            </Link>
          ))}
        </div>
      ) : null}


      {/* ── Filter panel: chips + search, same shape as every other list page ── */}
      <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
          {([
            { label: `${activePartCount} active`, value: "active" },
            { label: `${inactivePartCount} inactive`, value: "inactive" },
            { label: `${totalPartCount} all`, value: "all" },
          ] as const).map(({ label, value }) => (
            <Link
              key={value}
              href={`/inventory?status=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                statusFilter === value
                  ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                  : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40"
              }`}
            >
              {label}
            </Link>
          ))}
          {statusFilter === "active" ? (
            <>
              <span className="mx-1 h-5 w-px bg-[var(--line)]" aria-hidden="true" />
              {([
                { label: `${activeParts.length} all stock`, value: "all" },
                { label: `${lowStock.length} low`, value: "low" },
                { label: `${outOfStock.length} out`, value: "out" },
              ] as const).map(({ label, value }) => (
                <Link
                  key={value}
                  href={`/inventory?stock=${value}&status=active${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    stockFilter === value
                      ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                      : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </>
          ) : null}
        </div>
        <form method="GET" action="/inventory" className="flex items-center gap-2 p-3">
          <input type="hidden" name="status" value={statusFilter} />
          {stockFilter !== "all" ? <input type="hidden" name="stock" value={stockFilter} /> : null}
          <input
            name="q"
            defaultValue={q}
            aria-label="Search items"
            placeholder="Search by item name, SKU or manufacturer..."
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15"
          />
          <Button type="submit" variant="secondary" size="sm">Search</Button>
          {q || stockFilter !== "all" || statusFilter !== "active" ? (
            <Link href="/inventory" className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--ink-muted)]">Reset</Link>
          ) : null}
        </form>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-500">{error}</div>
      ) : null}
      {created ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-600">Item added successfully.</div>
      ) : null}


      {/* Add Item panel */}
      {canManage && showAdd && (
        <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Add Item</p>
          </div>
          <form action={createPartAction} className="p-3">
            <div className="grid gap-2 sm:grid-cols-[0.8fr_1.4fr_1fr_0.7fr_0.7fr_auto]">
              <input name="sku" placeholder="SKU *" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
              <input name="name" placeholder="Item name *" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
              <input name="manufacturer" placeholder="Manufacturer" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
              <input name="unitCost" placeholder="Unit cost" inputMode="decimal" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
              <input name="reorderLevel" placeholder="Reorder at" inputMode="numeric" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
              <Button type="submit" size="sm" className="px-4">Add</Button>
            </div>
          </form>
        </div>
      )}

      {/* Items table */}
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">
            Inventory Items
            <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--ink-muted)]">
              {filteredParts.length}{q ? ` matching "${q}"` : ""}
            </span>
          </p>
          {canManage && (
            <Button
              href={showAdd ? `/inventory?status=${statusFilter}` : `/inventory?add=1&status=${statusFilter}`}
              variant={showAdd ? "ghost" : "primary"}
              size="sm"
              className="px-4 font-bold"
            >
              {showAdd ? "Cancel" : "+ Add Item"}
            </Button>
          )}
        </div>

        <DataTable
          frameless
          rows={pageRows}
          getRowKey={(part) => part.id}
          rowClassName={(part) =>
            part.reorderLevel > 0 && part.qtyOnHand <= part.reorderLevel ? "bg-amber-500/5" : undefined
          }
          empty={
            q
              ? <>No items match &ldquo;{q}&rdquo;. <Link href={`/inventory?status=${statusFilter}`} className="text-[var(--accent)] hover:underline">Clear search</Link></>
              : statusFilter === "inactive" ? "No inactive items."
              : stockFilter === "low" ? "No items at or below reorder level."
              : stockFilter === "out" ? "No items out of stock."
              : <>No inventory items yet.{canManage ? <> <Link href="/inventory?add=1" className="text-[var(--accent)] hover:underline">Add your first item.</Link></> : null}</>
          }
          columns={[
            {
              key: "item",
              header: "Item",
              cell: (part) => {
                const isLow = part.reorderLevel > 0 && part.qtyOnHand <= part.reorderLevel;
                const isOut = part.qtyOnHand === 0;
                return (
                  <Link href={`/inventory/${part.id}`} className="group flex flex-col gap-0.5">
                    <span className="font-semibold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">{part.name}</span>
                    <span className="text-[11px] mono text-[var(--ink-muted)]">{part.sku}</span>
                    <span className="text-[11px] text-[var(--ink-muted)] md:hidden">{part.manufacturer ?? ""}</span>
                    {!part.isActive && <span className="text-[11px] font-semibold text-amber-600">Inactive</span>}
                    {isOut && part.isActive && <span className="text-[11px] font-semibold text-red-600">Out of stock</span>}
                    {isLow && !isOut && <span className="text-[11px] font-semibold text-amber-600">Low stock</span>}
                  </Link>
                );
              },
            },
            {
              key: "maker",
              header: "Maker",
              className: "hidden text-[12px] text-[var(--ink-muted)] md:table-cell",
              headerClassName: "hidden md:table-cell",
              cell: (part) => part.manufacturer ?? "—",
            },
            {
              key: "unitCost",
              header: "Unit Cost",
              align: "right",
              className: "hidden tabular-nums text-[12px] text-[var(--ink-muted)] lg:table-cell",
              headerClassName: "hidden lg:table-cell",
              cell: (part) => (part.unitCost != null ? formatMoney(part.unitCost) : "—"),
            },
            {
              key: "onHand",
              header: "On Hand",
              align: "right",
              className: "font-semibold tabular-nums",
              cell: (part) => {
                const isLow = part.reorderLevel > 0 && part.qtyOnHand <= part.reorderLevel;
                const isOut = part.qtyOnHand === 0;
                return (
                  <span className={isOut ? "text-red-500" : isLow ? "text-amber-600" : "text-[var(--ink)]"}>
                    {part.qtyOnHand}
                  </span>
                );
              },
            },
            {
              key: "reserved",
              header: "Reserved",
              align: "right",
              className: "hidden tabular-nums text-[12px] text-[var(--ink-muted)] sm:table-cell",
              headerClassName: "hidden sm:table-cell",
              cell: (part) => part.qtyReserved,
            },
            {
              key: "available",
              header: "Available",
              align: "right",
              className: "font-semibold tabular-nums",
              cell: (part) => {
                const available = part.qtyOnHand - part.qtyReserved;
                return <span className={available <= 0 ? "text-red-500" : "text-[var(--ink)]"}>{available}</span>;
              },
            },
            {
              key: "value",
              header: "Value",
              align: "right",
              className: "hidden tabular-nums text-[12px] text-[var(--ink)] xl:table-cell",
              headerClassName: "hidden xl:table-cell",
              cell: (part) => formatMoney((part.unitCost ?? 0) * part.qtyOnHand),
            },
            {
              key: "reorder",
              header: "Reorder",
              align: "right",
              className: "hidden tabular-nums text-[12px] text-[var(--ink-muted)] sm:table-cell",
              headerClassName: "hidden sm:table-cell",
              cell: (part) => part.reorderLevel || "—",
            },
          ]}
        />
      </div>

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="items"
        hrefForPage={hrefForPage}
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Recent Movements</p>
            <Link href="/inventory/stock-counts" className="text-xs font-semibold text-[var(--accent)] hover:underline">Audit stock</Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {recentMovements.map((movement) => (
              <Link key={movement.id} href={`/inventory/${movement.part.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--panel-strong)]/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{movement.part.name}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{movement.part.sku} · {movement.reason ?? "Stock movement"} · {movement.createdBy?.name ?? movement.createdBy?.email ?? "System"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-black tabular-nums ${movement.type === "IN" ? "text-emerald-600" : movement.type === "OUT" ? "text-red-600" : "text-amber-600"}`}>
                    {movement.type === "IN" ? "+" : movement.type === "OUT" ? "-" : ""}{Math.abs(movement.quantity)}
                  </p>
                  <p className="text-[11px] text-[var(--ink-muted)]">{movement.createdAt.toLocaleDateString("en-UG", { day: "numeric", month: "short" })}</p>
                </div>
              </Link>
            ))}
            {recentMovements.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[var(--ink-muted)]">No stock movements recorded yet.</p> : null}
          </div>
        </div>

        <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Replenishment Shortlist</p>
            <Link href="/inventory/purchase-requests/new" className="text-xs font-semibold text-[var(--accent)] hover:underline">New request</Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {lowStock.slice(0, 6).map((part) => {
              const gap = Math.max(0, part.reorderLevel - part.qtyOnHand);
              return (
                <Link key={part.id} href={`/inventory/${part.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--panel-strong)]/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">{part.name}</p>
                    <p className="truncate text-xs text-[var(--ink-muted)]">{part.sku} · reorder at {part.reorderLevel || "not set"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-black tabular-nums ${part.qtyOnHand === 0 ? "text-red-600" : "text-amber-600"}`}>{part.qtyOnHand}</p>
                    <p className="text-[11px] text-[var(--ink-muted)]">{gap} gap</p>
                  </div>
                </Link>
              );
            })}
            {lowStock.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[var(--ink-muted)]">No replenishment exceptions.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
