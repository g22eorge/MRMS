import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RowActionsMenu, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { RecordPreviewButton } from "@/components/record/RecordPreviewButton";
import { convertPurchaseRequestToPoAction, deletePurchaseRequestAction, reviewPurchaseRequestAction } from "../actions";

import { SubmitButton } from "@/components/ui/SubmitButton";
export const dynamic = "force-dynamic";

export default async function PurchaseRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
      convertedPo: { select: { id: true, reference: true } },
      items: { include: { part: { select: { sku: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  }).catch(() => null);
  if (!request || request.orgId !== orgId) notFound();

  const suppliers = await prisma.supplier.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";
  const total = request.items.reduce((sum, item) => sum + item.quantity * (item.estimatedUnitCost ?? 0), 0);
  // Review is only actionable before a decision: once approved the path forward
  // is Convert to PO, and rejected/cancelled/converted requests are terminal.
  const canReview = ["DRAFT", "SUBMITTED"].includes(request.status);
  const canConvert = request.status === "APPROVED";
  // One-click convert when the request already names its supplier — the same
  // fast path the list page uses. Otherwise the convert card below collects it.
  const quickConvert = canConvert && !request.convertedPo && request.supplierId;

  return (
    <div className="space-y-4">
      <RecordActionBar
        backHref="/inventory/purchase-requests"
        eyebrow="Inventory · Purchase Request"
        title={request.requestNumber}
        status={{ label: request.status, tone: request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : request.status === "CONVERTED" ? "violet" : request.status === "SUBMITTED" ? "sky" : "neutral" }}
        secondary={
          <>
            <RecordPreviewButton variant="button" label="Preview" pdfUrl={`/api/procurement/documents/purchase-request/${request.id}`} title={`Purchase Request ${request.requestNumber}`} />
            <Link href={`/api/procurement/documents/purchase-request/${request.id}`} target="_blank" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
              Print / PDF
            </Link>
          </>
        }
        primary={
          quickConvert ? (
            <form action={convertPurchaseRequestToPoAction}>
              <input type="hidden" name="id" value={request.id} />
              <input type="hidden" name="supplierId" value={request.supplierId ?? ""} />
              <SubmitButton bare className="btn-premium rounded-lg px-3 py-1.5 text-xs font-semibold">Create PO</SubmitButton>
            </form>
          ) : undefined
        }
        overflow={
          <RowActionsMenu label={`Purchase request actions for ${request.requestNumber}`} size="compact">
            <MenuDestructiveRow>
              <form action={deletePurchaseRequestAction}>
                <input type="hidden" name="id" value={request.id} />
                <SubmitButton bare className="w-full text-left text-[0.75rem] text-red-600">Delete Request</SubmitButton>
              </form>
            </MenuDestructiveRow>
          </RowActionsMenu>
        }
      />
      <p className="text-sm text-[var(--ink-muted)]">
        Requested by {request.requestedBy.name || request.requestedBy.email}
        {" · "}{request.priority.toLowerCase()} priority
        {" · "}needed {fmt(request.neededBy)}
        {" · "}{request.supplier?.name ?? "no supplier preference"}
        {" · "}est. <span className="font-semibold tabular-nums text-[var(--ink)]">{total.toLocaleString()}</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-x-auto">
        <div className="px-5 py-3 border-b border-[var(--line)]"><p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Items</p></div>
        <DataTable
          frameless
          dense
          rows={request.items}
          getRowKey={(item) => item.id}
          empty="No items on this request."
          columns={[
            { key: "description", header: "Description", className: "text-[var(--ink)]", cell: (item) => item.description },
            {
              key: "item",
              header: "Item",
              className: "hidden sm:table-cell text-[0.75rem] text-[var(--ink-muted)]",
              headerClassName: "hidden sm:table-cell",
              cell: (item) => (item.part ? item.part.name : "-"),
            },
            { key: "qty", header: "Qty", align: "right", className: "tabular-nums text-[var(--ink-muted)]", cell: (item) => item.quantity },
            { key: "estCost", header: "Est. Cost", align: "right", className: "tabular-nums text-[var(--ink-muted)]", cell: (item) => (item.estimatedUnitCost ?? 0).toLocaleString() },
            { key: "total", header: "Total", align: "right", className: "tabular-nums font-semibold text-[var(--ink)]", cell: (item) => (item.quantity * (item.estimatedUnitCost ?? 0)).toLocaleString() },
          ]}
          tableFooter={
            <tr>
              <td colSpan={2} className="px-3 py-2 text-right text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Estimate</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right font-black tabular-nums text-[var(--ink)]">{total.toLocaleString()}</td>
            </tr>
          }
        />
      </div>

      {request.reason || request.notes || request.reviewNote ? <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4 text-sm text-[var(--ink)]"><p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)] mb-2">Notes</p>{request.reason ? <p><strong>Reason:</strong> {request.reason}</p> : null}{request.notes ? <p className="mt-2 whitespace-pre-wrap">{request.notes}</p> : null}{request.reviewNote ? <p className="mt-2"><strong>Review:</strong> {request.reviewNote}</p> : null}</div> : null}

      {canConvert && !request.convertedPo && !request.supplierId ? <form action={convertPurchaseRequestToPoAction} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-3"><input type="hidden" name="id" value={request.id} /><p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Convert to Purchase Order</p><p className="text-sm text-[var(--ink-muted)]">Pick the supplier to order from — everything else carries over.</p><div className="grid gap-3 sm:grid-cols-3"><select name="supplierId" defaultValue={request.supplierId ?? ""} required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select><input name="reference" placeholder="PO reference" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]" /><input name="expectedAt" type="date" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]" /></div><SubmitButton bare className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold">Create PO</SubmitButton></form> : null}

      {canReview ? (
        <form action={reviewPurchaseRequestAction} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <input type="hidden" name="id" value={request.id} />
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Review request</p>
          <textarea name="reviewNote" rows={2} placeholder="Review note (optional)" className="mt-3 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50" />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <SubmitButton bare name="action" value="APPROVED" className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/25">Approve</SubmitButton>
            <SubmitButton bare name="action" value="REJECTED" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/20">Reject</SubmitButton>
            <SubmitButton bare name="action" value="CANCELLED" className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--panel-strong)]">Cancel</SubmitButton>
          </div>
        </form>
      ) : null}
      {["REJECTED", "CANCELLED"].includes(request.status) ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]/40 px-5 py-4 text-sm text-[var(--ink-muted)]">
          This request was <span className="font-semibold text-[var(--ink)]">{request.status.toLowerCase()}</span>
          {request.reviewedBy ? <> by {request.reviewedBy.name || request.reviewedBy.email}</> : null}
          {request.reviewNote ? <> — {request.reviewNote}</> : null}.
        </div>
      ) : null}
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <p className="border-b border-[var(--line)] px-4 py-3 text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Related</p>
            <div className="divide-y divide-[var(--line)]">
              <div className="px-4 py-3">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Supplier</p>
                {request.supplier ? (
                  <Link href={`/inventory/suppliers/${request.supplier.id}`} className="mt-0.5 block truncate text-sm font-semibold text-[var(--ink)] hover:text-[var(--accent)]">
                    {request.supplier.name}
                  </Link>
                ) : (
                  <p className="mt-0.5 text-sm text-[var(--ink-muted)]">No preference</p>
                )}
              </div>
              <div className="px-4 py-3">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Purchase order</p>
                {request.convertedPo ? (
                  <Link href={`/inventory/purchase-orders/${request.convertedPo.id}`} className="mono mt-0.5 block truncate text-sm font-bold text-[var(--accent)] hover:underline">
                    {request.convertedPo.reference ?? "Purchase order"}
                  </Link>
                ) : canConvert && request.supplierId ? (
                  <p className="mt-0.5 text-sm text-[var(--ink-muted)]">Ready — use Create PO above.</p>
                ) : (
                  <p className="mt-0.5 text-sm text-[var(--ink-muted)]">Converts on approval.</p>
                )}
              </div>
              <div className="px-4 py-3">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Requested by</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-[var(--ink)]">{request.requestedBy.name || request.requestedBy.email}</p>
                {request.reviewedBy ? (
                  <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">Reviewed by {request.reviewedBy.name || request.reviewedBy.email}</p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
