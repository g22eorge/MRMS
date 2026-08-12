import type { PaymentMethod } from "@prisma/client";
import { prisma, ensureMoneySchema } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { getCurrentUserRole } from "@/lib/session";
import { can } from "@/lib/permissions";
import { toBaseAmount } from "@/lib/currency";
import { findRecentDuplicate } from "@/lib/dedup";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CARD", "OTHER"];
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
  const reference = String(body.reference ?? "").trim().slice(0, 120) || null;

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

  // Foreign-currency payments must carry an FX rate; without it toBaseAmount
  // returns 0, so paidAmount never advances and the invoice never marks PAID.
  const rawRate = String(body.exchangeRateToBase ?? "").replace(/,/g, "").trim();
  const exchangeRateToBase = invCurrency === baseCurrency ? null : (rawRate ? Number(rawRate) : null);
  if (invCurrency !== baseCurrency && (!exchangeRateToBase || !Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0)) {
    return new Response("Exchange rate is required for a foreign-currency payment", { status: 400 });
  }

  const baseAmount = toBaseAmount({ amount, currency: invCurrency, baseCurrency, exchangeRateToBase });
  const baseTotal = toBaseAmount({ amount: invoice.totalAmount, currency: invCurrency, baseCurrency, exchangeRateToBase });
  // invoice.paidAmount is already stored in base currency (syncInvoicePaymentState),
  // so it must NOT be re-converted — doing so inflated it on foreign invoices and
  // wrongly rejected the second payment as an overpayment.
  const basePaid = invoice.paidAmount ?? 0;
  if (baseAmount > baseTotal - basePaid) {
    return new Response("Overpayment", { status: 400 });
  }

  const methodUpper = methodRaw.toUpperCase();
  const method: PaymentMethod = (PAYMENT_METHODS as string[]).includes(methodUpper)
    ? (methodUpper as PaymentMethod)
    : "OTHER";

  // The receipt post writes to the C5 ledger inside the transaction; make sure
  // those tables/columns exist first so a stale prod schema can't abort payment.
  await ensureMoneySchema();

  try {
    await prisma.$transaction(async (tx) => {
      // Double-submit guard: an identical payment landed on this invoice seconds
      // ago (impatient click on a slow server) — reuse it instead of charging twice.
      const dup = await findRecentDuplicate(tx.payment, {
        orgId,
        invoiceId,
        amount,
        method,
        kind: "PAYMENT",
      });
      if (dup) return;
      const payment = await tx.payment.create({
        data: {
          orgId: orgId,
          invoiceId,
          amount,
          currency: invCurrency,
          exchangeRateToBase,
          method,
          reference,
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
        issuedById: user.id, // required so the payment posts to the cash-basis ledger
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