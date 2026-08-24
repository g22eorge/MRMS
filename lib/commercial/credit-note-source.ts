import { prisma } from "@/lib/prisma";

/**
 * Load whatever a credit note is being raised against — a POS sale or an
 * invoice — in one shape.
 *
 * Sales and invoices describe their money differently: a Sale stores subtotal,
 * discount and VAT at the header, while an Invoice stores only a total and
 * keeps tax and discount per line. Everything downstream of this (the credit
 * value, the cumulative cap, the returned lines) only needs the gross the share
 * is measured against and the total being shared out, so that difference is
 * resolved here rather than repeated at every call site.
 */

export type CreditNoteSourceLine = {
  /** The parent line's id — what the dialog posts back as `itemId`. */
  id: string;
  /** Set only for stocked products, so only those restock on receive-back. */
  partId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  saleUomFactor: number | null;
};

export type CreditNoteSource = {
  kind: "sale" | "invoice";
  id: string;
  reference: string;
  currency: string | null;
  /** Gross value of all lines, before any document discount. */
  subtotal: number;
  /** What the customer was actually billed, net of discount and incl. tax. */
  total: number;
  /**
   * Has the customer actually paid? You cannot give back money you never took:
   * crediting an unsettled parent and refunding it drives paidAmount negative,
   * the same way an unbounded job refund used to. The picker only offers
   * settled documents, but the action reads sourceKey straight off the form,
   * so the rule has to live here as well.
   */
  settled: boolean;
  lines: CreditNoteSourceLine[];
};

/** Split a picker key like "invoice:abc123" into its parts. */
export function parseCreditNoteSourceKey(raw: string): { kind: "sale" | "invoice"; id: string } | null {
  const [kind, id] = String(raw ?? "").trim().split(":", 2);
  if (!id) return null;
  if (kind !== "sale" && kind !== "invoice") return null;
  return { kind, id };
}

type Db = Pick<typeof prisma, "sale" | "invoice">;

export async function loadCreditNoteSource(
  db: Db,
  params: { orgId: string; kind: "sale" | "invoice"; id: string; lineIds?: string[] },
): Promise<CreditNoteSource | null> {
  const { orgId, kind, id, lineIds } = params;

  if (kind === "sale") {
    const sale = await db.sale.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        saleNumber: true,
        currency: true,
        subtotal: true,
        totalAmount: true,
        status: true,
        items: {
          ...(lineIds?.length ? { where: { id: { in: lineIds } } } : {}),
          select: { id: true, partId: true, description: true, quantity: true, unitPrice: true, saleUomFactor: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!sale) return null;
    return {
      kind: "sale",
      id: sale.id,
      reference: sale.saleNumber,
      currency: sale.currency,
      subtotal: sale.subtotal,
      total: sale.totalAmount,
      settled: sale.status === "PAID" || sale.status === "PARTIALLY_RETURNED",
      lines: sale.items,
    };
  }

  const invoice = await db.invoice.findFirst({
    where: { id, orgId, status: { not: "VOID" } },
    select: {
      id: true,
      invoiceNumber: true,
      currency: true,
      totalAmount: true,
      status: true,
      paidAmount: true,
      lines: {
        ...(lineIds?.length ? { where: { id: { in: lineIds } } } : {}),
        select: {
          id: true,
          sourceType: true,
          sourceId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          saleUomFactor: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!invoice) return null;

  // An invoice stores no subtotal, so it is the sum of its line totals. When a
  // subset of lines was requested those are the only ones loaded, which would
  // understate the subtotal and inflate every share — so the gross is always
  // summed over ALL of the invoice's lines.
  const subtotalRows = lineIds?.length
    ? await db.invoice.findFirst({ where: { id, orgId }, select: { lines: { select: { lineTotal: true } } } })
    : null;
  const subtotal = (subtotalRows?.lines ?? invoice.lines).reduce((sum, l) => sum + l.lineTotal, 0);

  return {
    kind: "invoice",
    id: invoice.id,
    reference: invoice.invoiceNumber,
    currency: invoice.currency,
    subtotal,
    total: invoice.totalAmount,
    settled: invoice.status === "PAID" || invoice.paidAmount > 0,
    lines: invoice.lines.map((l) => ({
      id: l.id,
      // Only lines that came from stock carry a product, and that is the same
      // tag cost reporting uses. Labour and free-text lines credit money
      // without ever touching inventory.
      partId: l.sourceType === "Part" ? l.sourceId : null,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      saleUomFactor: l.saleUomFactor,
    })),
  };
}

/** Credit notes already raised against this parent, for the cumulative cap. */
export async function creditedSoFar(
  db: Pick<typeof prisma, "creditNote">,
  params: { orgId: string; kind: "sale" | "invoice"; id: string },
): Promise<number> {
  const agg = await db.creditNote.aggregate({
    where: {
      orgId: params.orgId,
      ...(params.kind === "sale" ? { saleId: params.id } : { invoiceId: params.id }),
    },
    _sum: { totalAmount: true },
  });
  return agg._sum.totalAmount ?? 0;
}
