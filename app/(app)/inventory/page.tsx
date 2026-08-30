import { Button } from "@/components/ui/Button";
import { NewProductModal } from "@/components/inventory/NewProductModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { HubTabs } from "@/components/shared/HubTabs";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Prisma } from "@prisma/client";

import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { PAGE_SIZE, parsePage, parsePageSize, paginationView, pageHrefBuilder, sizeHrefBuilder } from "@/lib/pagination";
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
  const stockFilter = (params.stock ?? "all") as "all" | "low" | "out";
  const requestedStatus = String(params.status ?? "active");
  const statusFilter: StockStatusFilter = requestedStatus === "inactive" || requestedStatus === "all" ? requestedStatus : "active";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);

  const canManage = can.manageInventory(user);

  // The stock filter (low = qtyOnHand <= reorderLevel) is a column-to-column
  // comparison Prisma's `where` can't express, and the KPI row previously loaded
  // the WHOLE catalog to reduce in JS. Run the list as parameterised SQL so we
  // paginate in the DB and return aggregates, not every row.
  const baseConds: Prisma.Sql[] = [Prisma.sql`"orgId" = ${orgId}`];
  if (statusFilter !== "all") baseConds.push(Prisma.sql`"isActive" = ${statusFilter === "active" ? 1 : 0}`);
  if (q) {
    const like = `%${q}%`;
    baseConds.push(Prisma.sql`("name" LIKE ${like} OR "sku" LIKE ${like} OR "manufacturer" LIKE ${like})`);
  }
  const stockConds: Prisma.Sql[] = [...baseConds];
  if (statusFilter === "active" && stockFilter === "low") stockConds.push(Prisma.sql`("qtyOnHand" <= "reorderLevel" AND "reorderLevel" > 0)`);
  if (statusFilter === "active" && stockFilter === "out") stockConds.push(Prisma.sql`"qtyOnHand" = 0`);
  const rowWhere = Prisma.sql`WHERE ${Prisma.join(stockConds, " AND ")}`;

  const coerceRow = (r: Record<string, unknown>): InventoryRow => ({
    id: String(r.id),
    sku: String(r.sku),
    name: String(r.name),
    manufacturer: r.manufacturer == null ? null : String(r.manufacturer),
    qtyOnHand: Number(r.qtyOnHand),
    qtyReserved: Number(r.qtyReserved),
    reorderLevel: Number(r.reorderLevel),
    unitCost: r.unitCost == null ? null : Number(r.unitCost),
    isActive: Boolean(r.isActive),
  });

  const [kpiRows, filteredCountRows, partStatusCounts, locationCount] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        SUM(CASE WHEN "qtyOnHand" <= "reorderLevel" AND "reorderLevel" > 0 THEN 1 ELSE 0 END) AS "lowStock",
        SUM(CASE WHEN "qtyOnHand" = 0 THEN 1 ELSE 0 END) AS "outOfStock",
        COALESCE(SUM(COALESCE("unitCost", 0) * "qtyOnHand"), 0) AS "totalValue",
        COALESCE(SUM("qtyReserved"), 0) AS "totalReserved",
        COALESCE(SUM("qtyOnHand"), 0) AS "totalOnHand",
        COALESCE(SUM(CASE WHEN "qtyOnHand" - "qtyReserved" > 0 THEN "qtyOnHand" - "qtyReserved" ELSE 0 END), 0) AS "totalAvailable",
        SUM(CASE WHEN "qtyOnHand" > 0 AND ("unitCost" IS NULL OR "unitCost" <= 0) THEN 1 ELSE 0 END) AS "noCostItems",
        SUM(CASE WHEN "reorderLevel" <= 0 THEN 1 ELSE 0 END) AS "noReorderItems",
        SUM(CASE WHEN "qtyReserved" > "qtyOnHand" THEN 1 ELSE 0 END) AS "overReserved",
        COALESCE(SUM(CASE WHEN "qtyOnHand" <= "reorderLevel" AND "reorderLevel" > 0 THEN ("reorderLevel" - "qtyOnHand") * COALESCE("unitCost", 0) ELSE 0 END), 0) AS "workingCapitalAtRisk"
      FROM "Part" WHERE "orgId" = ${orgId} AND "isActive" = 1
    `.catch(() => [] as Array<Record<string, unknown>>),
    prisma.$queryRaw<Array<{ c: number | bigint }>>`SELECT COUNT(*) AS c FROM "Part" ${rowWhere}`.catch(() => [{ c: 0 }]),
    prisma.part
      .groupBy({ by: ["isActive"], where: { orgId }, _count: { _all: true } })
      .catch(() => [] as Array<{ isActive: boolean; _count: { _all: number } }>),
    prisma.stockLocation.count({ where: { orgId, isActive: true } }).catch(() => 0),
  ]);

  const kpi = kpiRows[0] ?? {};
  const num = (v: unknown) => Number(v ?? 0) || 0;
  const lowStockCount = num(kpi.lowStock);
  const outOfStockCount = num(kpi.outOfStock);
  const totalValue = num(kpi.totalValue);
  const totalReserved = num(kpi.totalReserved);
  const totalOnHand = num(kpi.totalOnHand);
  const totalAvailable = num(kpi.totalAvailable);
  const stockAccuracyRisk = num(kpi.noCostItems) + num(kpi.noReorderItems) + num(kpi.overReserved);
  const workingCapitalAtRisk = num(kpi.workingCapitalAtRisk);

  const activePartCount = partStatusCounts.find((r) => r.isActive)?._count._all ?? 0;
  const inactivePartCount = partStatusCounts.find((r) => !r.isActive)?._count._all ?? 0;
  const totalPartCount = activePartCount + inactivePartCount;

  const filteredTotal = Number(filteredCountRows[0]?.c ?? 0);
  const pageView = paginationView(page, filteredTotal, pageSize);
  const pageRowsRaw = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, sku, name, manufacturer, "qtyOnHand", "qtyReserved", "reorderLevel", "unitCost", "isActive"
    FROM "Part" ${rowWhere}
    ORDER BY "qtyOnHand" ASC, name ASC
    LIMIT ${pageView.take} OFFSET ${pageView.skip}
  `.catch(() => [] as Array<Record<string, unknown>>);
  const pageRows = pageRowsRaw.map(coerceRow);
  const inventoryFilters = {
    status: statusFilter,
    stock: stockFilter !== "all" ? stockFilter : "",
    q,
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const hrefForPage = pageHrefBuilder("/inventory", inventoryFilters);
  const hrefForSize = sizeHrefBuilder("/inventory", inventoryFilters);

  const categoryRows = await prisma.part.findMany({
    where: { orgId, category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  const categories = categoryRows.map((r) => r.category).filter((c): c is string => Boolean(c));

  return (
    <div className="space-y-4">

      <HubTabs items={INVENTORY_TABS} />

      <PageHeader
        title="Items"
        description="See what you have, what is running low, and what it is worth."
        actions={canManage ? (
          <Button href="/api/reports/export?type=inventory-stock" external variant="secondary" size="sm">Export</Button>
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
            value: lowStockCount,
            sub: `${outOfStockCount} out · ${formatMoney(workingCapitalAtRisk)} reorder gap`,
            tone: "warn",
            muted: lowStockCount === 0,
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

      {/* ── Filter panel: chips + search ── */}
      <div className="dc-card space-y-2.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { label: `${activePartCount} active`, value: "active" },
            { label: `${inactivePartCount} inactive`, value: "inactive" },
            { label: `${totalPartCount} all`, value: "all" },
          ] as const).map(({ label, value }) => (
            <Link
              key={value}
              href={`/inventory?status=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition ${
                statusFilter === value
                  ? "border-[var(--accent)]/50 bg-[var(--accent)]/12 text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
              }`}
            >
              {label}
            </Link>
          ))}
          {statusFilter === "active" ? (
            <>
              <span className="mx-1 h-4 w-px bg-[var(--line)]" aria-hidden="true" />
              {([
                { label: `${activePartCount} all stock`, value: "all" },
                { label: `${lowStockCount} low`, value: "low" },
                { label: `${outOfStockCount} out`, value: "out" },
              ] as const).map(({ label, value }) => (
                <Link
                  key={value}
                  href={`/inventory?stock=${value}&status=active${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={`rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition ${
                    stockFilter === value
                      ? "border-[var(--accent)]/50 bg-[var(--accent)]/12 text-[var(--accent)]"
                      : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </>
          ) : null}
        </div>
        <form method="GET" action="/inventory" className="flex items-center gap-2">
          <input type="hidden" name="status" value={statusFilter} />
          {stockFilter !== "all" ? <input type="hidden" name="stock" value={stockFilter} /> : null}
          <div className="relative min-w-0 flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="9" cy="9" r="6" /><path strokeLinecap="round" d="m14 14 3.5 3.5" />
            </svg>
            <input
              name="q"
              defaultValue={q}
              aria-label="Search items"
              placeholder="Search by item name or manufacturer..."
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] py-1.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">Search</Button>
          {q || stockFilter !== "all" || statusFilter !== "active" ? (
            <Link href="/inventory" className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Reset</Link>
          ) : null}
        </form>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[0.8125rem] text-red-500">{error}</div>
      ) : null}
      {created ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[0.8125rem] text-emerald-600">Item added successfully.</div>
      ) : null}


      {/* Items table */}
      <div className="dc-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">
            Inventory Items
            <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--ink-muted)]">
              {filteredTotal}{q ? ` matching "${q}"` : ""}
            </span>
          </p>
          {canManage && <NewProductModal action={createPartAction} categories={categories} />}
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
              : "No inventory items yet."
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
                    <span className="text-[0.6875rem] text-[var(--ink-muted)] md:hidden">{part.manufacturer ?? ""}</span>
                    {!part.isActive && <span className="text-[0.6875rem] font-semibold text-amber-600">Inactive</span>}
                    {isOut && part.isActive && <span className="text-[0.6875rem] font-semibold text-red-600">Out of stock</span>}
                    {isLow && !isOut && <span className="text-[0.6875rem] font-semibold text-amber-600">Low stock</span>}
                  </Link>
                );
              },
            },
            {
              key: "maker",
              header: "Maker",
              className: "hidden text-[0.75rem] text-[var(--ink-muted)] md:table-cell",
              headerClassName: "hidden md:table-cell",
              cell: (part) => part.manufacturer ?? "—",
            },
            {
              key: "unitCost",
              header: "Unit Cost",
              align: "right",
              className: "hidden whitespace-nowrap tabular-nums text-[0.75rem] text-[var(--ink-muted)] lg:table-cell",
              headerClassName: "hidden lg:table-cell",
              cell: (part) => (part.unitCost != null ? formatMoney(part.unitCost) : "—"),
            },
            {
              key: "onHand",
              header: "On Hand",
              align: "right",
              className: "font-semibold tabular-nums whitespace-nowrap",
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
              className: "hidden whitespace-nowrap tabular-nums text-[0.75rem] text-[var(--ink-muted)] sm:table-cell",
              headerClassName: "hidden sm:table-cell",
              cell: (part) => part.qtyReserved,
            },
            {
              key: "available",
              header: "Available",
              align: "right",
              className: "font-semibold tabular-nums whitespace-nowrap",
              cell: (part) => {
                const available = part.qtyOnHand - part.qtyReserved;
                return <span className={available <= 0 ? "text-red-500" : "text-[var(--ink)]"}>{available}</span>;
              },
            },
            {
              key: "value",
              header: "Value",
              align: "right",
              className: "hidden whitespace-nowrap tabular-nums text-[0.75rem] text-[var(--ink)] xl:table-cell",
              headerClassName: "hidden xl:table-cell",
              cell: (part) => formatMoney((part.unitCost ?? 0) * part.qtyOnHand),
            },
            {
              key: "reorder",
              header: "Reorder",
              align: "right",
              className: "hidden whitespace-nowrap tabular-nums text-[0.75rem] text-[var(--ink-muted)] sm:table-cell",
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
        pageSize={pageSize}
        hrefForSize={hrefForSize}
      />
    </div>
  );
}
