// Backfill Receipt documents for sale (POS) payments that never got one.
//
// POS payments previously did not call createReceiptForPayment, so historical
// paid sales have Payment rows but no Receipt. New payments create receipts;
// this generates them for the existing ones. Idempotent (skips payments that
// already have a receipt).
//
// Usage:
//   DATABASE_URL=... bun scripts/backfill-sale-receipts.ts --dry-run
//   DATABASE_URL=... bun scripts/backfill-sale-receipts.ts

import { PrismaClient } from "@prisma/client";
import { createReceiptForPayment } from "../lib/commercial/document-workflow";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const payments = await prisma.payment.findMany({
  where: { saleId: { not: null } },
  select: {
    id: true,
    orgId: true,
    saleId: true,
    amount: true,
    currency: true,
    createdById: true,
    sale: { select: { clientId: true } },
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
  await prisma.$transaction(async (tx) => {
    await createReceiptForPayment(tx, {
      orgId: p.orgId,
      paymentId: p.id,
      saleId: p.saleId,
      clientId: p.sale?.clientId ?? null,
      amount: p.amount,
      currency: p.currency,
      issuedById: p.createdById ?? null,
    });
  });
  created++;
}

console.log(
  `${dryRun ? "[dry-run] would create" : "created"} ${created} receipt(s); ${skipped} sale payment(s) already had one.`,
);
await prisma.$disconnect();
