import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { can } from "@/lib/permissions";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { HubTabs } from "@/components/shared/HubTabs";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { createStockLocationAction, toggleStockLocationAction, updateStockLocationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function StockLocationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule(OrgModule.INVENTORY);
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const created = String(params.created ?? "") === "1";
  const saved = String(params.saved ?? "") === "1";
  const error = typeof params.error === "string" ? params.error : "";
  const page = parsePage(params.page);

  const [locations, locationsTotal, branches, stockRows] = await Promise.all([
    prisma.stockLocation.findMany({
      where: { orgId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }).catch(() => []),
    prisma.stockLocation.count({ where: { orgId } }).catch(() => 0),
    prisma.branch.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }).catch(() => []),
    prisma.partLocationStock.groupBy({
      by: ["locationId"],
      where: { orgId },
      _sum: { qtyOnHand: true, qtyReserved: true },
      _count: { partId: true },
    }).catch(() => []),
  ]);
  const activeLocations = await prisma.stockLocation.count({ where: { orgId, isActive: true } }).catch(() => 0);

  const stats = new Map(stockRows.map((row) => [row.locationId, row]));
  const totalOnHand = stockRows.reduce((sum, row) => sum + (row._sum.qtyOnHand ?? 0), 0);
  const branchName = new Map(branches.map((branch) => [branch.id, branch.name]));
  const pageView = paginationView(page, locationsTotal);
  const hrefForPage = pageHrefBuilder("/inventory/locations", {});

  // Named so the same actions menu renders in the desktop table AND mobile card.
  const renderLocationActions = (location: (typeof locations)[number]) => (
    <RowActionsMenu label={`Location actions for ${location.name}`}>
      <div className="w-72 p-3">
        <form action={updateStockLocationAction} className="grid gap-2 text-left">
          <input type="hidden" name="id" value={location.id} />
          <input name="name" defaultValue={location.name} required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60" />
          <input name="code" defaultValue={location.code ?? ""} placeholder="Code" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 uppercase outline-none focus:border-[var(--accent)]/60" />
          <select name="branchId" defaultValue={location.branchId ?? ""} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60">
            <option value="">No branch</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
            <input type="checkbox" name="isActive" value="1" defaultChecked={location.isActive} /> Active
          </label>
          <button type="submit" className="btn-premium rounded-lg px-3 py-1.5 font-semibold">Save Location</button>
        </form>
        <form action={toggleStockLocationAction} className="mt-2 border-t border-[var(--line)] pt-2">
          <input type="hidden" name="id" value={location.id} />
          <input type="hidden" name="isActive" value={location.isActive ? "0" : "1"} />
          <button type="submit" className="text-[12px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
            {location.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
      </div>
    </RowActionsMenu>
  );

  return (
    <ListPageLayout
      topBar={<HubTabs items={INVENTORY_TABS} />}
      header={{
        eyebrow: "Inventory",
        title: "Stock Locations",
        kpis: [
          { label: "Total", value: locationsTotal, sub: "locations" },
          { label: "Active", value: activeLocations, sub: "in use", valueClass: "text-emerald-600" },
          { label: "On Hand", value: totalOnHand.toLocaleString(), sub: "units stocked" },
        ],
      }}
      filters={
        <>
          {created ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">Location created.</div> : null}
          {saved ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">Location updated.</div> : null}
          {error ? <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div> : null}

          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
            <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Add Location</p>
            <form action={createStockLocationAction} className="grid gap-2 md:grid-cols-[1.4fr_0.7fr_1fr_auto]">
              <input name="name" placeholder="Location name *" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]/60" />
              <input name="code" placeholder="Code" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] uppercase outline-none focus:border-[var(--accent)]/60" />
              <select name="branchId" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]/60">
                <option value="">No branch</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
              <button type="submit" className="btn-premium rounded-lg px-4 py-1.5 text-[13px] font-semibold">Create</button>
            </form>
          </div>
        </>
      }
    >
      <DataTable
        rows={locations}
        getRowKey={(location) => location.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total: locationsTotal, hrefForPage, unit: "locations" }}
        empty="No stock locations yet. Create Main Stock, Store, Van, or Technician locations here."
        columns={[
          {
            key: "location",
            header: "Location",
            className: "font-semibold text-[var(--ink)]",
            cell: (location) => location.name,
          },
          {
            key: "code",
            header: "Code",
            className: "mono text-[var(--ink-muted)]",
            cell: (location) => location.code ?? "—",
          },
          {
            key: "branch",
            header: "Branch",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[var(--ink-muted)] md:table-cell",
            cell: (location) => location.branchId ? branchName.get(location.branchId) ?? "Linked branch" : "—",
          },
          {
            key: "items",
            header: "Items",
            align: "right",
            className: "whitespace-nowrap tabular-nums text-[var(--ink-muted)]",
            cell: (location) => stats.get(location.id)?._count.partId ?? 0,
          },
          {
            key: "onHand",
            header: "On Hand",
            align: "right",
            className: "whitespace-nowrap font-semibold tabular-nums text-[var(--ink)]",
            cell: (location) => stats.get(location.id)?._sum.qtyOnHand ?? 0,
          },
          {
            key: "reserved",
            header: "Reserved",
            align: "right",
            headerClassName: "hidden md:table-cell",
            className: "hidden whitespace-nowrap tabular-nums text-[var(--ink-muted)] md:table-cell",
            cell: (location) => stats.get(location.id)?._sum.qtyReserved ?? 0,
          },
          {
            key: "status",
            header: "Status",
            cell: (location) => (
              <StatusBadge tone={location.isActive ? "success" : "neutral"}>
                {location.isActive ? "Active" : "Inactive"}
              </StatusBadge>
            ),
          },
        ]}
        actions={renderLocationActions}
        renderMobileCard={(location) => (
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-[var(--ink)]">{location.name}{location.code ? <span className="ml-1.5 mono text-[12px] text-[var(--ink-muted)]">{location.code}</span> : null}</p>
              <p className="mt-0.5 truncate text-[12px] text-[var(--ink-muted)]">{location.branchId ? branchName.get(location.branchId) ?? "Linked branch" : "No branch"} · {stats.get(location.id)?._sum.qtyOnHand ?? 0} on hand</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusBadge tone={location.isActive ? "success" : "neutral"}>{location.isActive ? "Active" : "Inactive"}</StatusBadge>
              {renderLocationActions(location)}
            </div>
          </div>
        )}
      />
    </ListPageLayout>
  );
}
