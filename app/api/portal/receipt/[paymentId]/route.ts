import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { getPortalSession } from "@/lib/portal-auth";
import { PaymentReceiptDocument } from "@/lib/pdf/PaymentReceiptDocument";
import { resolveInvoiceLogo } from "@/lib/pdf/pdf-utils";
import { pdfAttachmentResponse } from "@/lib/pdf/pdf-response";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ paymentId: string }> }) {
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const { paymentId } = await ctx.params;
  const session = await getPortalSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, orgId: session.org.id },
    select: {
      id: true, amount: true, currency: true, method: true, reference: true, receivedAt: true,
      createdBy: { select: { name: true } },
      sale: { select: { saleNumber: true, clientId: true } },
      invoice: { select: { invoiceNumber: true, clientId: true, job: { select: { jobNumber: true, clientId: true } } } },
    },
  });
  if (!payment) return new Response("Not found", { status: 404 });

  // Isolation: the payment must belong to THIS customer (via its invoice's job/client or sale).
  const belongsToClient =
    payment.invoice?.job?.clientId === session.client.id ||
    payment.invoice?.clientId === session.client.id ||
    payment.sale?.clientId === session.client.id;
  if (!belongsToClient) return new Response("Not found", { status: 404 });

  const [branding, logoUrl, receipt] = await Promise.all([
    getDocumentBrandingSettings(session.org.id),
    resolveInvoiceLogo(),
    prisma.receipt.findFirst({ where: { orgId: session.org.id, paymentId: payment.id }, select: { receiptNumber: true } }),
  ]);
  const currency = normalizeCurrency(payment.currency, session.org.baseCurrency);
  const forLabel = payment.invoice?.job?.jobNumber
    ? `Repair job ${payment.invoice.job.jobNumber} (${payment.invoice.invoiceNumber})`
    : payment.invoice?.invoiceNumber
      ? `Invoice ${payment.invoice.invoiceNumber}`
      : payment.sale?.saleNumber
        ? `Sale ${payment.sale.saleNumber}`
        : "Payment";

  const element = createElement(PaymentReceiptDocument as never, {
    branding: { ...branding, companyLogoUrl: logoUrl ?? null },
    receiptNumber: receipt?.receiptNumber ?? `RCPT-${payment.id.slice(0, 8).toUpperCase()}`,
    receivedAt: payment.receivedAt.toLocaleString("en-GB"),
    method: payment.method.replaceAll("_", " "),
    reference: payment.reference,
    amountLabel: formatMoney(payment.amount, currency),
    forLabel,
    receivedBy: payment.createdBy?.name ?? session.org.name,
    clientName: session.client.fullName,
    clientOrganization: session.client.organization,
    clientPhone: null,
  });

  const pdf = await renderToBuffer(element as never);
  return pdfAttachmentResponse(new Uint8Array(pdf), `receipt-${payment.id.slice(0, 8)}.pdf`, inline);
}
