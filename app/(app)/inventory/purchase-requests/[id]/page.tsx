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
  const canReview = ["DRAFT", "SUBMITTED", "APPROVED"].includes(request.status);
  const canConvert = request.status === "APPROVED";

  return (
    <div className="max-w-4xl space-y-6">
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
      <p className="text-sm text-[var(--ink-muted)]">Requested by {request.requestedBy.name || request.requestedBy.email}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"><p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Priority</p><p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{request.priority}</p></div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"><p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Needed</p><p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{fmt(request.neededBy)}</p></div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"><p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Supplier</p><p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{request.supplier?.name ?? "No preference"}</p></div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"><p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Estimate</p><p className="mt-0.5 text-sm font-semibold text-[var(--ink)] tabular-nums">{total.toLocaleString()}</p></div>
      </div>

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
        />
      </div>

      {request.reason || request.notes || request.reviewNote ? <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4 text-sm text-[var(--ink)]"><p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)] mb-2">Notes</p>{request.reason ? <p><strong>Reason:</strong> {request.reason}</p> : null}{request.notes ? <p className="mt-2 whitespace-pre-wrap">{request.notes}</p> : null}{request.reviewNote ? <p className="mt-2"><strong>Review:</strong> {request.reviewNote}</p> : null}</div> : null}

      {request.convertedPo ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-700">Converted to <Link href={`/inventory/purchase-orders/${request.convertedPo.id}`} className="font-semibold underline">{request.convertedPo.reference ?? "purchase order"}</Link>.</div> : null}

      {canConvert ? <form action={convertPurchaseRequestToPoAction} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-3"><input type="hidden" name="id" value={request.id} /><p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Convert to Purchase Order</p><div className="grid gap-3 sm:grid-cols-3"><select name="supplierId" defaultValue={request.supplierId ?? ""} required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select><input name="reference" placeholder="PO reference" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]" /><input name="expectedAt" type="date" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]" /></div><SubmitButton bare className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold">Create PO</SubmitButton></form> : null}

      {canReview ? <div className="grid gap-3 sm:grid-cols-3"><form action={reviewPurchaseRequestAction} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 space-y-2"><input type="hidden" name="id" value={request.id} /><input type="hidden" name="action" value="APPROVED" /><textarea name="reviewNote" rows={2} placeholder="Approval note" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-xs" /><SubmitButton bare className="w-full rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-700">Approve</SubmitButton></form><form action={reviewPurchaseRequestAction} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 space-y-2"><input type="hidden" name="id" value={request.id} /><input type="hidden" name="action" value="REJECTED" /><textarea name="reviewNote" rows={2} placeholder="Rejection reason" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-xs" /><SubmitButton bare className="w-full rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600">Reject</SubmitButton></form><form action={reviewPurchaseRequestAction} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 space-y-2"><input type="hidden" name="id" value={request.id} /><input type="hidden" name="action" value="CANCELLED" /><textarea name="reviewNote" rows={2} placeholder="Cancel note" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-xs" /><SubmitButton bare className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--ink-muted)]">Cancel</SubmitButton></form></div> : null}
    </div>
  );
}
