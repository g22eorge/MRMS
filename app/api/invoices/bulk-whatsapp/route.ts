import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { orgDb } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

export async function POST(req: NextRequest) {
  const { user } = await getCurrentUserRole();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const ids = JSON.parse(form.get("ids") as string) as string[];
  const orgId = user.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "No invoices selected" }, { status: 400 });
  // Bounded batch: provider calls fan out in small parallel chunks instead
  // of one serial chain per invoice.
  const BATCH_SIZE = 100;
  const CHUNK_SIZE = 10;
  const batch = ids.slice(0, BATCH_SIZE);
  const db = orgDb(orgId);
  // Captured narrowed for the remindOne closure below.
  const org: string = orgId;
  const actorUserId = user.id;

  const invoices = await db.invoice.findMany({
    where: { id: { in: batch }, orgId: orgId },
    select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, currency: true, client: { select: { phone: true } } },
  });

  async function remindOne(invoice: (typeof invoices)[number]) {
    const toPhoneRaw = invoice.client?.phone;
    if (!toPhoneRaw) return;
    const toPhone = toPhoneRaw.replace(/[^+0-9]/g, "");
    if (!toPhone) return;
    const balance = Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0));
    const body = `Invoice ${invoice.invoiceNumber}: ${formatMoney(invoice.totalAmount, invoice.currency ?? "UGX")}${balance > 0 ? ` — Balance: ${formatMoney(balance, invoice.currency ?? "UGX")}` : " — Paid"}`;
    await enqueueWhatsAppMessage({
      orgId: org,
      to: toPhone,
      body,
      jobId: undefined,
      type: "INVOICE_REMINDER",
    });
    await writeSystemAuditEvent({
      orgId: org,
      action: "INVOICE_WHATSAPP_SENT",
      entityType: "Invoice",
      entityId: invoice.id,
      actorUserId: actorUserId,
      summary: `Bulk WhatsApp sent for ${invoice.invoiceNumber}`,
    });
  }

  for (let i = 0; i < invoices.length; i += CHUNK_SIZE) {
    await Promise.allSettled(invoices.slice(i, i + CHUNK_SIZE).map(remindOne));
  }

  revalidatePath("/documents/invoices");
  return NextResponse.redirect(new URL("/documents/invoices", req.url));
}
