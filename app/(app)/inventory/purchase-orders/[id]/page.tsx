import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { assertOrgCanMutate } from "@/lib/org-write";
import { formatMoney } from "@/lib/currency";
import { DataTable } from "@/components/ui/DataTable";
import { toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RowActionsMenu, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { RecordPreviewButton } from "@/components/record/RecordPreviewButton";
import { ReceiveStockForm } from "./ReceiveStockForm";
import { POMetaForm } from "./POMetaForm";
import { deletePurchaseOrderAction, setPurchaseOrderStatusAction } from "../actions";

import { SubmitButton } from "@/components/ui/SubmitButton";
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

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      goodsReceivedNotes: {
        include: {
          location: { select: { name: true, code: true } },
          items: { select: { id: true, quantity: true, unitCost: true } },
        },
        orderBy: { receivedAt: "desc" },
      },
      items: {
        include: { part: { select: { id: true, name: true, sku: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { purchaseRequests: true, supplierBills: true } },
    },
  });

  if (!po || po.orgId !== orgId) notFound();

  const totalOrdered = po.items.reduce((sum, item) => sum + item.qtyOrdered * item.unitCost, 0);
  const receivedQty = po.items.reduce((sum, item) => sum + item.qtyReceived, 0);
  const orderedQty = po.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
  const receivedRatio = orderedQty > 0 ? Math.min(100, Math.round((receivedQty / orderedQty) * 100)) : 0;
  const canReceive = ["ORDERED", "PARTIAL"].includes(po.status);
  const canCancel = !["RECEIVED", "CANCELLED"].includes(po.status) && receivedQty === 0;
  const isOverdue = canReceive && po.expectedAt && po.expectedAt < new Date();

  const locations = await prisma.stockLocation.findMany({
    where: { orgId, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: [{ name: "asc" }],
  });

  // Create the first stock location inline so receiving is never a dead-end.
  async function createLocationForPoAction(formData: FormData) {
    "use server";
    const ctx = await requireOrgSession();
    if (!can.manageInventory(ctx.user)) redirect("/inventory");
    assertOrgCanMutate({ access: ctx.org.access, userRole: ctx.user.role, userAccessMode: ctx.user.accessMode, kind: "GENERAL" });
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const code = String(formData.get("code") ?? "").trim().toUpperCase() || null;
    try {
      await prisma.stockLocation.create({ data: { orgId: ctx.orgId, name, code, isActive: true } });
    } catch {
      /* ignore duplicate code — the existing location will simply appear */
    }
    revalidatePath(`/inventory/purchase-orders/${id}`);
  }

  return (
    <div className="space-y-3">
      {sp.error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-[0.8125rem] font-medium text-red-600">
          {sp.error}
        </p>
      ) : null}
      <RecordActionBar
        backHref="/inventory/purchase-orders"
        eyebrow="Purchase Order"
        title={poNumber(po)}
        status={{ label: po.status, tone: toneFor(STATUS_TONES, po.status) }}
        secondary={
          <>
            {isOverdue ? <span className="self-center rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-red-600">Late</span> : null}
            <RecordPreviewButton variant="button" label="Preview" pdfUrl={`/api/procurement/documents/purchase-order/${po.id}`} title={`Purchase Order ${poNumber(po)}`} />
            <Link href={`/api/procurement/documents/purchase-order/${po.id}`} target="_blank" className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)]">Print / PDF</Link>
          </>
        }
        primary={
          po.status === "DRAFT" ? (
            <form action={setPurchaseOrderStatusAction}>
              <input type="hidden" name="id" value={po.id} />
              <input type="hidden" name="status" value="ORDERED" />
              <SubmitButton bare className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-700">Issue</SubmitButton>
            </form>
          ) : canReceive ? (
            <Link href="#receive" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">Receive</Link>
          ) : null
        }
        overflow={
          <RowActionsMenu label={`Purchase order actions for ${poNumber(po)}`} size="compact">
            {canCancel ? (
              <MenuDestructiveRow>
                <form action={setPurchaseOrderStatusAction}>
                  <input type="hidden" name="id" value={po.id} />
                  <input type="hidden" name="status" value="CANCELLED" />
                  <SubmitButton bare className="w-full text-left text-[0.75rem] text-red-600">Cancel Order</SubmitButton>
                </form>
              </MenuDestructiveRow>
            ) : null}
            <MenuDestructiveRow>
              <form action={deletePurchaseOrderAction}>
                <input type="hidden" name="id" value={po.id} />
                <SubmitButton bare className="w-full text-left text-[0.75rem] text-red-600">Delete Order</SubmitButton>
              </form>
            </MenuDestructiveRow>
          </RowActionsMenu>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {[
          ["Supplier", po.supplier.name],
          ["Ordered", fmtDate(po.orderedAt)],
          ["Expected", fmtDate(po.expectedAt)],
          ["Received", `${receivedQty}/${orderedQty}`],
          ["Progress", `${receivedRatio}%`],
          ["Value", formatMoney(totalOrdered)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">{label}</p>
            <p className="mt-1 truncate text-sm font-bold text-[var(--ink)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-strong)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${receivedRatio}%` }} />
      </div>

      {po.status !== "RECEIVED" && po.status !== "CANCELLED" ? (
        <POMetaForm po={{ id: po.id, reference: po.reference, orderedAt: po.orderedAt, expectedAt: po.expectedAt, notes: po.notes, status: po.status }} />
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
          <p className="text-sm font-bold text-[var(--ink)]">Line items</p>
          <p className="text-xs font-semibold text-[var(--ink-muted)]">{po.items.length} lines</p>
        </div>
        <DataTable
          frameless
          dense
          rows={po.items}
          getRowKey={(item) => item.id}
          empty="No line items."
          columns={[
            {
              key: "description",
              header: "Description",
              className: "font-medium text-[var(--ink)]",
              cell: (item) => item.description,
            },
            {
              key: "item",
              header: "Item",
              className: "mono text-[0.75rem] text-[var(--ink-muted)]",
              cell: (item) => (item.part ? item.part.name : "-"),
            },
            {
              key: "ordered",
              header: "Ordered",
              align: "right",
              className: "tabular-nums text-[var(--ink-muted)]",
              cell: (item) => item.qtyOrdered,
            },
            {
              key: "received",
              header: "Received",
              align: "right",
              className: "font-semibold tabular-nums text-[var(--ink)]",
              cell: (item) => item.qtyReceived,
            },
            {
              key: "balance",
              header: "Balance",
              align: "right",
              className: "tabular-nums text-[var(--ink-muted)]",
              cell: (item) => Math.max(0, item.qtyOrdered - item.qtyReceived),
            },
            {
              key: "unitCost",
              header: "Unit cost",
              align: "right",
              className: "tabular-nums text-[var(--ink-muted)]",
              cell: (item) => formatMoney(item.unitCost),
            },
            {
              key: "total",
              header: "Total",
              align: "right",
              className: "font-semibold tabular-nums text-[var(--ink)]",
              cell: (item) => formatMoney(item.qtyOrdered * item.unitCost),
            },
          ]}
          tableFooter={
            <tr>
              <td colSpan={6} className="px-3 py-2 text-right text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Total</td>
              <td className="px-3 py-2 text-right font-black tabular-nums text-[var(--ink)]">{formatMoney(totalOrdered)}</td>
            </tr>
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {canReceive && locations.length > 0 ? (
            <div id="receive">
              <ReceiveStockForm
                poId={po.id}
                locations={locations}
                items={po.items.map((item) => ({
                  id: item.id,
                  description: item.description,
                  qtyOrdered: item.qtyOrdered,
                  qtyReceived: item.qtyReceived,
                }))}
              />
            </div>
          ) : null}
          {canReceive && locations.length === 0 ? (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="text-sm font-bold text-[var(--ink)]">Receive stock</p>
              <p className="mt-0.5 text-[0.8125rem] text-[var(--ink-muted)]">You have no stock location yet — create one here and keep going, no need to leave this page.</p>
              <form action={createLocationForPoAction} className="mt-2 flex flex-wrap items-end gap-2">
                <input name="name" required placeholder="Location name (e.g. Main Store)" className="min-w-[180px] flex-1 rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/10" />
                <input name="code" placeholder="Code (optional)" className="w-32 rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-sm uppercase outline-none focus:ring-2 focus:ring-[var(--accent)]/10" />
                <SubmitButton bare className="btn-premium rounded-md px-3 py-1.5 text-sm font-semibold">Create &amp; continue</SubmitButton>
              </form>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          {po.notes ? (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink)]">{po.notes}</p>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
              <p className="text-sm font-bold text-[var(--ink)]">Goods received</p>
              <Link href="/inventory/goods-received" className="text-xs font-semibold text-[var(--accent)] hover:underline">All GRNs</Link>
            </div>
            {po.goodsReceivedNotes.length === 0 ? (
              <p className="px-3 py-3 text-sm text-[var(--ink-muted)]">No GRNs posted.</p>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {po.goodsReceivedNotes.map((grn) => {
                  const total = grn.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
                  return (
                    <Link key={grn.id} href={`/inventory/goods-received/${grn.id}`} className="block px-3 py-2 hover:bg-[var(--panel-strong)]/40">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--ink)]">{grn.grnNumber}</p>
                        <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">{formatMoney(total)}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{fmtDate(grn.receivedAt)} · {grn.location.name}{grn.location.code ? ` (${grn.location.code})` : ""}</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
