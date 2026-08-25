import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

import { formatMoney } from "@/lib/currency";
import { formatEATDocDate } from "@/lib/date-eat";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { EagleInfoDocument, type EagleInfoLineItem } from "@/lib/pdf/EagleInfoDocument";
import { resolveInvoiceLogo } from "@/lib/pdf/pdf-utils";
import { prisma } from "@/lib/prisma";
import { creditNoteParent } from "@/lib/commercial/credit-note-parent";

import { clientContactName } from "@/lib/client-name";
import { pickDocumentTerms } from "@/lib/quote-terms";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const { user, orgId } = await requireOrgSession();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "MANAGER"].includes(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const creditNote = await prisma.creditNote.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      creditNoteNumber: true,
      currency: true,
      totalAmount: true,
      issuedAt: true,
      reason: true,
      itemsReceivedBackAt: true,
      itemsReceivedBackNote: true,
      sale: {
        select: {
          saleNumber: true,
          client: { select: { fullName: true, phone: true, email: true, organization: true } },
        },
      },
      invoice: {
        select: {
          invoiceNumber: true,
          client: { select: { fullName: true, phone: true, email: true, organization: true } },
          job: { select: { jobNumber: true, client: { select: { fullName: true, phone: true, email: true, organization: true } } } },
        },
      },
      items: {
        select: { description: true, quantity: true, unitPrice: true, lineTotal: true },
        orderBy: { createdAt: "asc" },
      },
      refunds: { select: { amount: true } },
    },
  });

  if (!creditNote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [branding, logoUrl] = await Promise.all([
    getDocumentBrandingSettings(orgId),
    resolveInvoiceLogo(),
  ]);
  const address = [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join("\n");
  const currency = creditNote.currency;
  const parent = creditNoteParent(creditNote);
  const refundedTotal = creditNote.refunds.reduce((sum, refund) => sum + refund.amount, 0);
  const outstandingCredit = Math.max(0, creditNote.totalAmount - refundedTotal);
  const lineItems: EagleInfoLineItem[] = creditNote.items.length > 0
    ? creditNote.items.map((item) => ({
        name: item.description,
        quantity: item.quantity,
        rate: formatMoney(item.unitPrice, currency),
        amount: formatMoney(item.lineTotal, currency),
      }))
    : [{
        name: creditNote.reason ?? "Credit adjustment",
        quantity: 1,
        rate: formatMoney(creditNote.totalAmount, currency),
        amount: formatMoney(creditNote.totalAmount, currency),
      }];

  const docElement = createElement(EagleInfoDocument, {
    companyName: branding.companyName,
    companyAddress: address,
    companyPhone: branding.companyContacts || null,
    companyEmail: branding.companyEmail || null,
    companyWebsite: branding.companyWebsite || null,
    companyLogoUrl: logoUrl || null,
    docTitle: "Credit Note",
    docNumber: creditNote.creditNoteNumber,
    docDate: formatEATDocDate(creditNote.issuedAt),
    terms: "Sales return / adjustment",
    dueDate: null,
    clientName: parent.clientName,
    clientAttn: clientContactName(parent.client),
    clientEmail: parent.client?.email ?? null,
    clientPhone: parent.client?.phone ?? null,
    clientLocation: null,
    lineItems,
    subTotal: formatMoney(creditNote.totalAmount, currency),
    // Lead with the credit issued rather than what is left outstanding on it.
    headlineLabel: "Credit Issued",
    headlineAmount: formatMoney(creditNote.totalAmount, currency),
    totalLabel: "Credit Total",
    totalAmount: formatMoney(creditNote.totalAmount, currency),
    paymentMade: formatMoney(refundedTotal, currency),
    balanceDue: formatMoney(outstandingCredit, currency),
    notes: [
      parent.label || null,
      creditNote.reason ? `Reason: ${creditNote.reason}` : null,
      creditNote.itemsReceivedBackAt ? `Items received back: ${formatEATDocDate(creditNote.itemsReceivedBackAt)}` : "Items return pending",
      creditNote.itemsReceivedBackNote ? `Return note: ${creditNote.itemsReceivedBackNote}` : null,
    ].filter(Boolean).join("\n"),
    paymentTo: null,
    termsText: pickDocumentTerms(
      branding.termsText,
      creditNote.invoice?.job ? "REPAIR" : creditNote.sale || creditNote.invoice ? "SALE" : "MIXED",
    ),
  });

  try {
    const pdf = await renderToBuffer(docElement as never);
    return new Response(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="credit-note-${creditNote.creditNoteNumber}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF generation error";
    return NextResponse.json({ error: `Credit note PDF generation failed: ${message}` }, { status: 500 });
  }
}
