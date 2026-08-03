// @ts-nocheck
// Backfill Receipt documents for payments that never got one.
//
// Both POS sale payments (addPaymentAction) and repair/job payments
// (recordClientPaymentAction) previously did not call createReceiptForPayment,
// so historical paid sales and repair invoices have Payment rows but no Receipt.
// New payments now create receipts; this generates them for the existing ones.
// Idempotent (skips payments that already have a receipt) and skips REFUND-kind
// payments (which never get a receipt). Supports --dry-run.
//
// Usage:
//   DATABASE_URL=... bun scripts/backfill-sale-receipts.ts --dry-run
//   DATABASE_URL=... bun scripts/backfill-sale-receipts.ts

import { PrismaClient } from "@prisma/client";
import { createReceiptForPayment } from "../lib/commercial/document-workflow";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const payments = await prisma.payment.findMany({
  where: {
    OR: [{ saleId: { not: null } }, { invoiceId: { not: null } }],
    kind: { not: "REFUND" },
  },
  select: {
    id: true,
    orgId: true,
    saleId: true,
    invoiceId: true,
    amount: true,
    currency: true,
    createdById: true,
    sale: { select: { clientId: true } },
    invoice: { select: { clientId: true, job: { select: { clientId: true } } } },
  },
});

let created = 0;
let skipped = 0;
for (const p of payments) {
  const existing = await prisma.receipt.findFirst({
    where: { orgId: p.orgId, paymentId: p.id },
    select: { id: true },
  });
  if (existing) {
    skipped++;
    continue;
  }
  if (dryRun) {
    created++;
    continue;
  }
  const clientId = p.sale?.clientId ?? p.invoice?.clientId ?? p.invoice?.job?.clientId ?? null;
  await prisma.$transaction(async (tx) => {
    await createReceiptForPayment(tx, {
      orgId: p.orgId,
      paymentId: p.id,
      saleId: p.saleId,
      invoiceId: p.invoiceId,
      clientId,
      amount: p.amount,
      currency: p.currency,
      issuedById: p.createdById ?? null,
    });
  });
  created++;
}

console.log(
  `${dryRun ? "[dry-run] would create" : "created"} ${created} receipt(s); ${skipped} payment(s) already had one.`,
);
await prisma.$disconnect();
