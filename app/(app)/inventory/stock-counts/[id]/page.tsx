// @ts-nocheck
import { notFound, redirect } from "next/navigation";

import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RowActionsMenu, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { approveStockCountAction, cancelStockCountAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function StockCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const count = await prisma.stockCount.findUnique({
    where: { id },
    include: {
      location: { select: { name: true, code: true } },
      createdBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
      items: {
        include: { part: { select: { sku: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  }).catch(() => null);

  if (!count || count.orgId !== orgId) notFound();

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";

  const varianceLines = count.items.filter((item) => item.varianceQty !== 0).length;

  return (
    <div className="max-w-4xl space-y-6">
      <RecordActionBar
        backHref="/inventory/stock-counts"
        eyebrow="Inventory · Stock Count"
        title={count.countNumber}
        status={{ label: count.status, tone: count.status === "APPROVED" ? "success" : count.status === "CANCELLED" ? "danger" : "sky" }}
        primary={
          count.status === "SUBMITTED" ? (
            <form action={approveStockCountAction}>
              <input type="hidden" name="id" value={count.id} />
              <button type="submit" className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Approve and adjust stock
              </button>
            </form>
          ) : null
        }
        overflow={
          count.status === "SUBMITTED" ? (
            <RowActionsMenu label={`Stock count actions for ${count.countNumber}`} size="compact">
              <MenuDestructiveRow>
                <form action={cancelStockCountAction}>
                  <input type="hidden" name="id" value={count.id} />
                  <button type="submit" className="w-full text-left text-[12px] text-red-600">Cancel Count</button>
                </form>
              </MenuDestructiveRow>
            </RowActionsMenu>
          ) : undefined
        }
      />
      <p className="text-sm text-[var(--ink-muted)]">
        {count.location.name}{count.location.code ? ` (${count.location.code})` : ""}
      </p>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Counted</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{fmt(count.countedAt)}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Items</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{count.items.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Variances</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{varianceLines}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Approved</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{fmt(count.approvedAt)}</p>
        </div>
      </div>

      {/* Items table */}
      <DataTable
        rows={count.items}
        getRowKey={(item) => item.id}
        rowClassName={(item) => (item.varianceQty !== 0 ? "bg-amber-500/5" : undefined)}
        empty="No items counted."
        columns={[
          {
            key: "item",
            header: "Item",
            cell: (item) => (
              <>
                <p className="font-semibold text-[var(--ink)]">{item.part.sku}</p>
                <p className="text-[12px] text-[var(--ink-muted)]">{item.part.name}</p>
              </>
            ),
          },
          { key: "system", header: "System", align: "right", className: "whitespace-nowrap tabular-nums text-[var(--ink-muted)]", cell: (item) => item.systemQty },
          { key: "counted", header: "Counted", align: "right", className: "whitespace-nowrap tabular-nums text-[var(--ink)]", cell: (item) => item.countedQty },
          { key: "variance", header: "Variance", align: "right", className: "whitespace-nowrap font-semibold tabular-nums text-[var(--ink)]", cell: (item) => item.varianceQty },
          {
            key: "note",
            header: "Note",
            className: "hidden text-[12px] text-[var(--ink-muted)] sm:table-cell",
            headerClassName: "hidden sm:table-cell",
            cell: (item) => item.note ?? "-",
          },
        ]}
      />

      {/* Notes */}
      {count.note ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4 text-sm text-[var(--ink)] whitespace-pre-wrap">
          {count.note}
        </div>
      ) : null}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
        <p>Created by {count.createdBy.name || count.createdBy.email}.</p>
      </div>
    </div>
  );
}
