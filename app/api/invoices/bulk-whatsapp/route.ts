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
  const db = orgDb(orgId);

  const invoices = await db.invoice.findMany({
    where: { id: { in: ids }, orgId: orgId },
    select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, currency: true, client: { select: { phone: true } } },
  });

  for (const invoice of invoices) {
    const toPhoneRaw = invoice.client?.phone;
    if (!toPhoneRaw) continue;
    const toPhone = toPhoneRaw.replace(/[^+0-9]/g, "");
    if (!toPhone) continue;
    const balance = Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0));
    const body = `Invoice ${invoice.invoiceNumber}: ${formatMoney(invoice.totalAmount, invoice.currency ?? "UGX")}${balance > 0 ? ` — Balance: ${formatMoney(balance, invoice.currency ?? "UGX")}` : " — Paid"}`;
    await enqueueWhatsAppMessage({
      orgId: orgId,
      to: toPhone,
      body,
      jobId: undefined,
      type: "INVOICE_REMINDER" as any,
    });
    await writeSystemAuditEvent({
      orgId: orgId,
      action: "INVOICE_WHATSAPP_SENT",
      entityType: "Invoice",
      entityId: invoice.id,
      actorUserId: user.id,
      summary: `Bulk WhatsApp sent for ${invoice.invoiceNumber}`,
    });
  }

  revalidatePath("/documents/invoices");
  return NextResponse.redirect(new URL("/documents/invoices", req.url));
}
