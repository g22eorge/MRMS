import { NextRequest, NextResponse } from "next/server";

import { can } from "@/lib/permissions";
import { shareQuotationDocument } from "@/lib/notifications/share-document";
import { getCurrentUserRole } from "@/lib/session";

/**
 * Bulk WhatsApp for selected quotations.
 *
 * The quotations list has carried a bulk action bar for some time, copied from
 * the invoices one, but only the invoice routes were ever written. A POST to
 * /api/quotations/bulk-whatsapp matched the [id] route instead, which exports
 * GET alone, so every bulk send returned 405 — and the bar reloaded the page
 * without reading the response, so it looked like it had worked.
 *
 * It sends through shareQuotationDocument, the same path the single Send button
 * on a quotation uses, so one selected row and one opened quotation now do the
 * same thing rather than two things that merely look alike.
 */
export async function POST(req: NextRequest) {
  const { user } = await getCurrentUserRole();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = user.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  let ids: string[] = [];
  try {
    const parsed = JSON.parse(String((await req.formData()).get("ids") ?? "[]"));
    if (Array.isArray(parsed)) ids = parsed.map(String).filter(Boolean);
  } catch {
    return NextResponse.json({ error: "Malformed selection" }, { status: 400 });
  }
  if (ids.length === 0) return NextResponse.json({ error: "Nothing selected" }, { status: 400 });

  let sent = 0;
  const failed: string[] = [];
  for (const quotationId of ids) {
    // One bad recipient must not abandon the rest of the selection.
    const ok = await shareQuotationDocument({ orgId, quotationId, channel: "whatsapp" }).catch(() => false);
    if (ok) sent += 1;
    else failed.push(quotationId);
  }

  return NextResponse.json({ ok: failed.length === 0, sent, failed: failed.length, total: ids.length });
}
