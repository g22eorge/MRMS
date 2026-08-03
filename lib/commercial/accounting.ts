// @ts-nocheck
import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type InvoiceLineInput = {
  sourceType?: string | null;
  sourceId?: string | null;
  description: string;
  quantity?: number;
  unitPrice: number;
  discountAmount?: number;
  taxAmount?: number;
  lineTotal: number;
};

export async function replaceAccountingInvoiceLines({
  tx,
  orgId,
  invoiceId,
  lines,
}: {
  tx: Tx;
  orgId: string;
  invoiceId: string;
  lines: InvoiceLineInput[];
}) {
  try {
    await tx.invoiceLine.deleteMany({ where: { orgId, invoiceId } });
    if (lines.length === 0) return;

    await tx.invoiceLine.createMany({
      data: lines.map((line) => ({
        orgId,
        invoiceId,
        sourceType: line.sourceType ?? null,
        sourceId: line.sourceId ?? null,
        description: line.description,
        quantity: line.quantity ?? 1,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount ?? 0,
        taxAmount: line.taxAmount ?? 0,
        lineTotal: line.lineTotal,
      })),
    });
  } catch {
    // Commercial tables are additive; do not break legacy invoicing during staged rollout.
  }
}

export async function replaceDocumentTaxLines({
  tx,
  orgId,
  documentType,
  documentId,
  taxLabel,
  taxRate,
  taxableAmount,
  taxAmount,
}: {
  tx: Tx;
  orgId: string;
  documentType: string;
  documentId: string;
  taxLabel: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}) {
  try {
    await tx.documentTaxLine.deleteMany({ where: { orgId, documentType, documentId } });
    if (taxAmount <= 0) return;

    await tx.documentTaxLine.create({
      data: {
        orgId,
        documentType,
        documentId,
        taxLabel,
        taxRate,
        taxableAmount,
        taxAmount,
      },
    });
  } catch {
    // Optional accounting detail table; ignore when schema has not been deployed yet.
  }
}
