import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { orgDb } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { enqueueEmailMessage } from "@/lib/notifications/whatsapp-outbox";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

export async function POST(req: NextRequest) {
  const { user } = await getCurrentUserRole();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = user.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const form = await req.formData();
  const ids = JSON.parse(form.get("ids") as string) as string[];
  const db = orgDb(orgId);

  const invoices = await db.invoice.findMany({
    where: { id: { in: ids }, orgId: orgId },
    select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, currency: true, subject: true, client: { select: { email: true } } },
  });

  for (const invoice of invoices) {
    if (!invoice.client?.email) continue;
    const balance = Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0));
    const subjectLine = `Invoice ${invoice.invoiceNumber} from Eagle Info Solutions`;
    const body = `${subjectLine}\n\nTotal: ${formatMoney(invoice.totalAmount, invoice.currency ?? "USD")}\nBalance: ${formatMoney(balance, invoice.currency ?? "USD")}\n\n${invoice.subject ?? invoice.invoiceNumber}`;
    await enqueueEmailMessage({
      orgId: orgId,
      to: invoice.client.email,
      subject: subjectLine,
      body,
      jobId: undefined,
      type: "INVOICE_REMINDER",
    });
    await writeSystemAuditEvent({
      orgId: orgId,
      action: "INVOICE_EMAIL_SENT",
      entityType: "Invoice",
      entityId: invoice.id,
      actorUserId: user.id,
      summary: `Bulk email sent for ${invoice.invoiceNumber}`,
    });
  }

  revalidatePath("/documents/invoices");
  return NextResponse.redirect(new URL("/documents/invoices", req.url));
}
