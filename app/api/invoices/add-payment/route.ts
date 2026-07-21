import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { getCurrentUserRole } from "@/lib/session";
import { can } from "@/lib/permissions";
import { toBaseAmount } from "@/lib/currency";
import { createReceiptForPayment, nextDocumentNumber } from "@/lib/commercial/document-workflow";
import { syncInvoicePaymentState } from "@/lib/commercial/payment-sync";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user } = await getCurrentUserRole();
  if (!(can.approveInvoices(user) || ["ADMIN", "OPS", "FINANCE"].includes(user.role))) {
    return new Response("Unauthorized", { status: 403 });
  }
  const orgId = user.orgId;
  if (!orgId) return new Response("No organization", { status: 400 });

  const body = await request.json();
  const invoiceId = body.invoiceId;
  const rawAmount = String(body.amount ?? "").replace(/,/g, "").trim();
  const amount = Number(rawAmount);
  const methodRaw = String(body.method ?? "CASH").trim();

  if (!invoiceId || !amount || amount <= 0) {
    return new Response("Invalid input", { status: 400 });
  }

  const db = orgDb(orgId);
  const org = await db.organization.findFirst({ where: { id: orgId }, select: { baseCurrency: true } });
  const baseCurrency = org?.baseCurrency ?? "UGX";

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, orgId: orgId },
    select: { totalAmount: true, paidAmount: true, status: true, currency: true },
  });
  if (!invoice || invoice.status === "VOID") {
    return new Response("Invoice not found", { status: 404 });
  }

  const invCurrency = invoice.currency ?? "UGX";
  const baseAmount = toBaseAmount({ amount, currency: invCurrency, baseCurrency, exchangeRateToBase: null });
  const baseTotal = toBaseAmount({ amount: invoice.totalAmount, currency: invCurrency, baseCurrency, exchangeRateToBase: null });
  const basePaid = toBaseAmount({ amount: invoice.paidAmount ?? 0, currency: invCurrency, baseCurrency, exchangeRateToBase: null });
  if (baseAmount > baseTotal - basePaid) {
    return new Response("Overpayment", { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orgId: orgId,
          invoiceId,
          amount,
          currency: invCurrency,
          method: methodRaw.toUpperCase() as any,
          kind: "PAYMENT",
          receivedAt: new Date(),
          createdById: user.id,
        },
      });

      await createReceiptForPayment(tx, {
        orgId: orgId,
        invoiceId,
        paymentId: payment.id,
        amount,
        currency: invCurrency,
      });

      await syncInvoicePaymentState(tx, {
        orgId: orgId,
        invoiceId,
        baseCurrency,
        actorUserId: user.id,
      });
    });

    revalidatePath(`/documents/invoices/${invoiceId}`);
    revalidatePath("/documents/invoices");

    return Response.json({ ok: true, redirect: `/documents/invoices/${invoiceId}` });
  } catch (err) {
    console.error("Payment failed:", err);
    return new Response("Failed to process payment", { status: 500 });
  }
}