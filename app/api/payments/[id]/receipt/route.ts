import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { amountInWords } from "@/lib/amount-in-words";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { PaymentReceiptDocument } from "@/lib/pdf/PaymentReceiptDocument";
import { resolveInvoiceLogo } from "@/lib/pdf/pdf-utils";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function prettyEnum(value: string) {
  return value.replaceAll("_", " ");
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const { user, orgId, org } = await requireOrgSession();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const payment = await prisma.payment.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      reference: true,
      receivedAt: true,
      createdBy: { select: { name: true } },
      sale: {
        select: {
          id: true, saleNumber: true, totalAmount: true, paidAmount: true,
          subtotal: true, discountAmount: true, vatAmount: true, taxApplicable: true,
          client: { select: { fullName: true, organization: true, phone: true } },
          items: {
            select: { description: true, quantity: true, unitPrice: true, lineTotal: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      // invoice.client as well as invoice.job.client: an invoice raised without
      // a job — a straight sale of goods — carries its customer directly, and
      // reading only the job's meant the receipt printed "Received from: —"
      // for every one of them.
      invoice: {
        select: {
          id: true, invoiceNumber: true, totalAmount: true, paidAmount: true,
          client: { select: { fullName: true, organization: true, phone: true } },
          lines: {
            select: { description: true, quantity: true, unitPrice: true, lineTotal: true, taxAmount: true },
            orderBy: { createdAt: "asc" },
          },
          job: { select: { id: true, jobNumber: true, client: { select: { fullName: true, organization: true, phone: true } } } },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [branding, logoUrl] = await Promise.all([
    getDocumentBrandingSettings(orgId),
    resolveInvoiceLogo(orgId),
  ]);
  const receipt = await prisma.receipt.findFirst({
    where: { orgId, paymentId: payment.id },
    select: { receiptNumber: true },
  });
  const currency = normalizeCurrency(payment.currency, org.baseCurrency);
  const forLabel = payment.invoice?.job?.jobNumber
    ? `Repair job ${payment.invoice.job.jobNumber} (${payment.invoice.invoiceNumber})`
    : payment.sale?.saleNumber
      ? `Sale ${payment.sale.saleNumber}`
      : payment.invoice?.invoiceNumber
        ? `Invoice ${payment.invoice.invoiceNumber}`
        : "Payment";

  const clientName = payment.invoice?.job?.client?.fullName
    ?? payment.invoice?.client?.fullName
    ?? payment.sale?.client?.fullName
    ?? null;
  const clientOrganization = payment.invoice?.job?.client?.organization
    ?? payment.invoice?.client?.organization
    ?? payment.sale?.client?.organization
    ?? null;
  const clientPhone = payment.invoice?.job?.client?.phone
    ?? payment.invoice?.client?.phone
    ?? payment.sale?.client?.phone
    ?? null;

  // Cumulative paid + outstanding balance on the linked invoice/sale, so the
  // receipt shows real "Payment Made" and "Balance Due" (not a hardcoded zero).
  const docTotal = payment.invoice?.totalAmount ?? payment.sale?.totalAmount ?? null;
  const docPaid = payment.invoice?.paidAmount ?? payment.sale?.paidAmount ?? null;
  const docBalance = docTotal != null && docPaid != null ? Math.max(0, docTotal - docPaid) : null;

  // What the money was actually for. The receipt used to print one made-up line
  // reading "Payment received - Invoice X", so a customer who paid for two items
  // got a receipt naming neither, and had no document tying the amount to goods.
  // A partial payment still lists everything: the lines describe the debt, and
  // Total / Payment Made / Balance Due below them say how much of it is settled.
  const sourceLines = payment.invoice?.lines?.length
    ? payment.invoice.lines
    : payment.sale?.items?.length
      ? payment.sale.items
      : [];
  const lineItems = sourceLines.map((l) => ({
    name: l.description,
    quantity: l.quantity,
    rate: formatMoney(l.unitPrice, currency),
    amount: formatMoney(l.lineTotal, currency),
  }));

  // With real lines on the page the money column has to reconcile: they sum to
  // the subtotal, not to the total. Printing the total alone would give a table
  // whose rows visibly do not add up to the figure beneath them wherever tax or
  // a discount applies. The two documents keep their breakdown in different
  // places — an invoice carries tax per line, a sale carries it on the document
  // — so each is read the way its own PDF route already reads it.
  const money = (v: number | null | undefined) =>
    v != null && v !== 0 ? formatMoney(v, currency) : null;

  let subtotalLabel: string | null = null;
  let discountLabel: string | null = null;
  let vatLabel: string | null = null;
  if (payment.invoice) {
    const sub = payment.invoice.lines.reduce((s, l) => s + l.lineTotal, 0);
    const tax = payment.invoice.lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
    subtotalLabel = formatMoney(sub, currency);
    vatLabel = money(tax);
  } else if (payment.sale) {
    subtotalLabel = formatMoney(payment.sale.subtotal, currency);
    discountLabel = money(payment.sale.discountAmount);
    vatLabel = payment.sale.taxApplicable ? money(payment.sale.vatAmount) : null;
  }

  const element = createElement(PaymentReceiptDocument as never, {
    branding: { ...branding, companyLogoUrl: logoUrl ?? null },
    receiptNumber: receipt?.receiptNumber ?? `RCPT-${payment.id.slice(0, 8).toUpperCase()}`,
    receivedAt: payment.receivedAt.toLocaleString("en-GB"),
    method: prettyEnum(payment.method),
    reference: payment.reference,
    amountLabel: formatMoney(payment.amount, currency),
    paidLabel: docPaid != null ? formatMoney(docPaid, currency) : null,
    balanceLabel: docBalance != null ? formatMoney(docBalance, currency) : null,
    forLabel,
    receivedBy: payment.createdBy?.name ?? user.name,
    clientName,
    clientOrganization,
    clientPhone,
    lineItems,
    docTotalLabel: docTotal != null ? formatMoney(docTotal, currency) : null,
    subtotalLabel,
    discountLabel,
    vatLabel,
    amountWords: amountInWords(payment.amount, currency),
  });

  const pdf = await renderToBuffer(element as never);
  return new Response(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="receipt-${payment.id.slice(0, 8)}.pdf"`,
    },
  });
}
