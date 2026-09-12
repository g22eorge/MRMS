export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { requireModule, OrgModule } from "@/lib/module-access";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { formatEATDate, formatEATTime } from "@/lib/date-eat";
import type { BadgeTone } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { sanitizeText } from "@/lib/sanitize";
import { shareDeliveryNoteDocument } from "@/lib/notifications/share-document";
import { DocumentActionBar } from "@/components/documents/DocumentActionBar";
import { DocumentSummaryRail } from "@/components/documents/DocumentSummaryRail";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { flash } from "@/lib/flash";
const cardClass = "overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]";
const cardHeadClass = "border-b border-[var(--line)] px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]";
const clientSelect = { fullName: true, phone: true, email: true, organization: true, address: true } as const;

export default async function DeliveryNoteDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requireModule(OrgModule.INVOICING);
  const { user } = await getCurrentUserRole();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
  if (!user.orgId) redirect("/dashboard");
  const orgId = user.orgId;

  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const sent = typeof sp.sent === "string" ? sp.sent : undefined;

  const note = await prisma.deliveryNote.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      deliveryNoteNumber: true,
      deliveredAt: true,
      deliveryMethod: true,
      deliveredByName: true,
      receivedByName: true,
      receivedBySignatureText: true,
      note: true,
      invoice: { select: { id: true, invoiceNumber: true, client: { select: clientSelect }, job: { select: { id: true, jobNumber: true, client: { select: clientSelect } } } } },
      sale: { select: { id: true, saleNumber: true, client: { select: clientSelect } } },
      items: { select: { id: true, description: true, quantity: true }, orderBy: { id: "asc" } },
    },
  });
  if (!note) redirect("/documents/delivery-notes");

  const canEditItems = can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role);
  const isEdit = sp.edit === "1" && canEditItems;

  async function addDeliveryItem(fd: FormData) {
    "use server";
    const { user: actor, orgId: actorOrg, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS"].includes(actor.role))) redirect("/dashboard");
    const target = await prisma.deliveryNote.findFirst({ where: { id, orgId: actorOrg }, select: { id: true } });
    if (!target) return;
    const description = sanitizeText(String(fd.get("description") ?? "").trim());
    const quantity = Math.max(1, Math.round(Number(fd.get("quantity")) || 1));
    if (!description) return;
    await prisma.deliveryNoteItem.create({ data: { deliveryNoteId: id, description, quantity } });
    revalidatePath(`/documents/delivery-notes/${id}`);
    redirect(flash(`/documents/delivery-notes/${id}?edit=1`, "Delivery item added"));
  }

  async function updateDeliveryItem(fd: FormData) {
    "use server";
    const { user: actor, orgId: actorOrg, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS"].includes(actor.role))) redirect("/dashboard");
    const itemId = String(fd.get("itemId") ?? "").trim();
    const owned = await prisma.deliveryNoteItem.findFirst({ where: { id: itemId, deliveryNote: { id, orgId: actorOrg } }, select: { id: true } });
    if (!owned) return;
    const description = sanitizeText(String(fd.get("description") ?? "").trim());
    const quantity = Math.max(1, Math.round(Number(fd.get("quantity")) || 1));
    await prisma.deliveryNoteItem.update({ where: { id: itemId }, data: { ...(description ? { description } : {}), quantity } });
    revalidatePath(`/documents/delivery-notes/${id}`);
    redirect(flash(`/documents/delivery-notes/${id}?edit=1`, "Delivery item updated"));
  }

  async function removeDeliveryItem(fd: FormData) {
    "use server";
    const { user: actor, orgId: actorOrg, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS"].includes(actor.role))) redirect("/dashboard");
    const itemId = String(fd.get("itemId") ?? "").trim();
    const owned = await prisma.deliveryNoteItem.findFirst({ where: { id: itemId, deliveryNote: { id, orgId: actorOrg } }, select: { id: true } });
    if (!owned) return;
    await prisma.deliveryNoteItem.delete({ where: { id: itemId } });
    revalidatePath(`/documents/delivery-notes/${id}`);
    redirect(flash(`/documents/delivery-notes/${id}?edit=1`, "Delivery item removed"));
  }

  const client = note.invoice?.job?.client ?? note.invoice?.client ?? note.sale?.client ?? null;
  const canSend = can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role);
  const methodLabel = note.deliveryMethod ? note.deliveryMethod.charAt(0) + note.deliveryMethod.slice(1).toLowerCase() : "—";

  const source = note.invoice
    ? { label: note.invoice.invoiceNumber, href: `/documents/invoices/${note.invoice.id}`, kind: "Invoice" }
    : note.sale
      ? { label: note.sale.saleNumber, href: `/pos/${note.sale.id}`, kind: "Sale" }
      : null;

  async function sendDeliveryNoteWhatsAppAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "FRONT_DESK"].includes(actor.role))) return;
    const ok = await shareDeliveryNoteDocument({ orgId: actorOrg, deliveryNoteId: id, channel: "whatsapp" });
    redirect(`/documents/delivery-notes/${id}?sent=${ok ? "whatsapp" : "failed"}`);
  }
  async function sendDeliveryNoteEmailAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "FRONT_DESK"].includes(actor.role))) return;
    const ok = await shareDeliveryNoteDocument({ orgId: actorOrg, deliveryNoteId: id, channel: "email" });
    redirect(`/documents/delivery-notes/${id}?sent=${ok ? "email" : "failed"}`);
  }

  const status: { label: string; tone: BadgeTone } = { label: methodLabel === "—" ? "Delivered" : methodLabel, tone: "accent" };

  const secondary = (
    <>
      {canSend && client?.phone && (
        <form action={sendDeliveryNoteWhatsAppAction} className="inline">
          <SubmitButton bare className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[0.75rem] font-medium">WhatsApp</SubmitButton>
        </form>
      )}
      {canSend && client?.email && (
        <form action={sendDeliveryNoteEmailAction} className="inline">
          <SubmitButton bare className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[0.75rem] font-medium">Email</SubmitButton>
        </form>
      )}
      <a href={`/api/delivery-notes/${note.id}`} target="_blank" rel="noreferrer" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem] font-bold">PDF</a>
    </>
  );

  const rows = [
    { label: "Delivered", value: formatEATDate(note.deliveredAt) },
    { label: "Method", value: methodLabel },
    { label: "Delivered by", value: note.deliveredByName },
    { label: "Received by", value: note.receivedByName },
    ...(source ? [{ label: "For", value: source.kind }] : []),
  ];

  const related = [
    ...(source ? [{ label: source.label, href: source.href, sub: source.kind }] : []),
    ...(note.invoice?.job ? [{ label: note.invoice.job.jobNumber, href: `/jobs/${note.invoice.job.id}`, sub: "Job" }] : []),
  ];

  return (
    <section className="space-y-4 pb-20">
      <DocumentActionBar
        backHref="/documents/delivery-notes"
        eyebrow="Documents · Delivery Notes"
        title={`Delivery note ${note.deliveryNoteNumber}`}
        status={status}
        secondary={secondary}
      />

      {sent && (
        <div className={`rounded-xl border px-4 py-3 text-[0.8125rem] font-medium ${sent === "failed" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"}`}>
          {sent === "whatsapp" && "WhatsApp message queued — track delivery in the outbox."}
          {sent === "email" && "Email queued — track delivery in the outbox."}
          {sent === "failed" && "Could not send: no client phone or email on file for this delivery note."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className={cardClass}>
            <div className={`${cardHeadClass} flex items-center justify-between`}>
              <span>Items delivered{isEdit ? " · editing" : ""}</span>
              {canEditItems ? (
                <a href={`/documents/delivery-notes/${id}${isEdit ? "" : "?edit=1"}`} className="text-[0.6875rem] font-semibold normal-case tracking-normal text-[var(--accent)] hover:underline">
                  {isEdit ? "Done" : "Edit"}
                </a>
              ) : null}
            </div>
            {isEdit ? (
              <div className="divide-y divide-[var(--line)]">
                {note.items.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-end gap-2 p-3">
                    <form action={updateDeliveryItem} className="flex flex-1 flex-wrap items-end gap-2">
                      <input type="hidden" name="itemId" value={item.id} />
                      <label className="min-w-[150px] flex-1 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Description
                        <input name="description" defaultValue={item.description} className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                      </label>
                      <label className="w-16 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Qty
                        <input name="quantity" type="number" min="1" step="1" defaultValue={item.quantity} className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                      </label>
                      <SubmitButton bare className="btn-premium-secondary h-9 rounded-md px-3 text-[0.75rem] font-semibold">Save</SubmitButton>
                    </form>
                    <form action={removeDeliveryItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <SubmitButton bare className="h-9 rounded-md border border-red-500/30 px-3 text-[0.75rem] font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400">Remove</SubmitButton>
                    </form>
                  </div>
                ))}
                <form action={addDeliveryItem} className="flex flex-wrap items-end gap-2 bg-[var(--panel-strong)]/40 p-3">
                  <label className="min-w-[150px] flex-1 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Add item
                    <input name="description" required placeholder="Item delivered" className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                  </label>
                  <label className="w-16 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Qty
                    <input name="quantity" type="number" min="1" step="1" defaultValue={1} className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                  </label>
                  <SubmitButton bare className="btn-premium h-9 rounded-md px-3 text-[0.75rem] font-bold">Add</SubmitButton>
                </form>
              </div>
            ) : note.items.length ? (
              <DataTable
                frameless
                rows={note.items}
                getRowKey={(l) => l.id}
                dense
                columns={[
                  { key: "description", header: "Description", cell: (row) => <span className="font-medium">{row.description}</span> },
                  { key: "quantity", header: "Qty", align: "right", className: "w-[80px] whitespace-nowrap tabular-nums", cell: (row) => <span className="tabular-nums">{row.quantity}</span> },
                ]}
              />
            ) : <div className="p-4 text-[0.8125rem] text-[var(--ink-muted)]">No itemised lines.</div>}
          </div>

          <div className={cardClass}>
            <div className={cardHeadClass}>Handover</div>
            <div className="grid grid-cols-1 gap-4 p-4 min-[600px]:grid-cols-2">
              <div>
                <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Delivered by</p>
                <p className="text-[0.8125rem] font-medium">{note.deliveredByName}</p>
              </div>
              <div>
                <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Received by</p>
                <p className="text-[0.8125rem] font-medium">{note.receivedByName}</p>
              </div>
              <div>
                <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Delivered on</p>
                <p className="text-[0.8125rem] font-medium">{formatEATDate(note.deliveredAt)} · {formatEATTime(note.deliveredAt)}</p>
              </div>
              <div>
                <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Method</p>
                <p className="text-[0.8125rem] font-medium">{methodLabel}</p>
              </div>
              {note.receivedBySignatureText && (
                <div className="min-[600px]:col-span-2">
                  <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Signature</p>
                  <p className="text-[0.8125rem] font-medium italic">{sanitizeText(note.receivedBySignatureText)}</p>
                </div>
              )}
              {note.note && (
                <div className="min-[600px]:col-span-2">
                  <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Note</p>
                  <p className="whitespace-pre-wrap text-[0.8125rem] text-[var(--ink-muted)]">{sanitizeText(note.note)}</p>
                </div>
              )}
            </div>
          </div>

          {source && (
            <div className={cardClass}>
              <div className={cardHeadClass}>Delivery for</div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{source.kind}</p>
                  <p className="mono text-[0.875rem] font-semibold">{source.label}</p>
                </div>
                <a href={source.href} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[0.75rem] font-medium">Open {source.kind.toLowerCase()} →</a>
              </div>
            </div>
          )}
        </div>

        <DocumentSummaryRail
          headline={{ label: "Delivered", value: formatEATDate(note.deliveredAt), tone: "good" }}
          rows={rows}
          client={client}
          related={related}
          activity={[{ label: "Delivered", at: formatEATDate(note.deliveredAt) }]}
        />
      </div>
    </section>
  );
}
