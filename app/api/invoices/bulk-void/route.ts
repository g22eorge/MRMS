import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { orgDb } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

export async function POST(req: NextRequest) {
  const { user } = await getCurrentUserRole();
  if (!(can.approveInvoices(user) || ["ADMIN", "FINANCE"].includes(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const ids = JSON.parse(form.get("ids") as string) as string[];
  const reason = sanitizeText(form.get("reason") as string) || "Bulk void";
  const orgId = user.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });
  const db = orgDb(orgId);

  await db.invoice.updateMany({
    where: { id: { in: ids }, orgId: orgId, status: { not: "VOID" } },
    data: { status: "VOID" },
  });

  for (const id of ids) {
    await writeSystemAuditEvent({
      orgId: orgId,
      action: "INVOICE_VOIDED",
      entityType: "Invoice",
      entityId: id,
      actorUserId: user.id,
      summary: `${reason}`,
    });
  }

  revalidatePath("/documents/invoices");
  return NextResponse.redirect(new URL("/documents/invoices", req.url));
}
