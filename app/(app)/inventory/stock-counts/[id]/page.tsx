import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RowActionsMenu, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
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
    <div className="space-y-4">
      <RecordActionBar
        backHref="/inventory/stock-counts"
        eyebrow="Inventory · Stock Count"
        title={count.countNumber}
        status={{ label: count.status, tone: count.status === "APPROVED" ? "success" : count.status === "CANCELLED" ? "danger" : "sky" }}
        primary={
          count.status === "SUBMITTED" ? (
            <form action={approveStockCountAction}>
              <input type="hidden" name="id" value={count.id} />
              <ConfirmSubmitButton
                message="Approve this count and adjust stock? All counted variances will be applied to on-hand quantities and this can't be undone."
                confirmLabel="Approve & adjust"
                className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Approve and adjust stock
              </ConfirmSubmitButton>
            </form>
          ) : null
        }
        overflow={
          count.status === "SUBMITTED" ? (
            <RowActionsMenu label={`Stock count actions for ${count.countNumber}`} size="compact">
              <MenuDestructiveRow>
                <form action={cancelStockCountAction}>
                  <input type="hidden" name="id" value={count.id} />
                  <ConfirmSubmitButton message="Cancel this stock count? This can't be undone." confirmLabel="Cancel count" className="w-full text-left text-[0.75rem] text-red-600">Cancel Count</ConfirmSubmitButton>
                </form>
              </MenuDestructiveRow>
            </RowActionsMenu>
          ) : undefined
        }
      />
      <p className="text-sm text-[var(--ink-muted)]">
        {count.location.name}{count.location.code ? ` (${count.location.code})` : ""}
        {" · "}counted {fmt(count.countedAt)}
        {" · "}{count.items.length} item{count.items.length === 1 ? "" : "s"}
        {" · "}<span className={varianceLines > 0 ? "font-semibold text-amber-600" : undefined}>{varianceLines} variance{varianceLines === 1 ? "" : "s"}</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
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
                <p className="font-semibold text-[var(--ink)]">{item.part.name}</p>
                <p className="text-[0.75rem] text-[var(--ink-muted)]">{item.part.sku}</p>
              </>
            ),
          },
          { key: "system", header: "System", align: "right", className: "whitespace-nowrap tabular-nums text-[var(--ink-muted)]", cell: (item) => item.systemQty },
          { key: "counted", header: "Counted", align: "right", className: "whitespace-nowrap tabular-nums text-[var(--ink)]", cell: (item) => item.countedQty },
          { key: "variance", header: "Variance", align: "right", className: "whitespace-nowrap font-semibold tabular-nums text-[var(--ink)]", cell: (item) => item.varianceQty },
          {
            key: "note",
            header: "Note",
            className: "hidden text-[0.75rem] text-[var(--ink-muted)] sm:table-cell",
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
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <p className="border-b border-[var(--line)] px-4 py-3 text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Related</p>
            <div className="divide-y divide-[var(--line)]">
              <div className="px-4 py-3">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Location</p>
                <Link href="/inventory/locations" className="mt-0.5 block truncate text-sm font-semibold text-[var(--ink)] hover:text-[var(--accent)]">
                  {count.location.name}{count.location.code ? ` (${count.location.code})` : ""}
                </Link>
              </div>
              <div className="px-4 py-3">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Counted by</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-[var(--ink)]">{count.createdBy.name || count.createdBy.email}</p>
                {count.approvedBy ? (
                  <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">Approved by {count.approvedBy.name || count.approvedBy.email}{count.approvedAt ? ` · ${fmt(count.approvedAt)}` : ""}</p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
