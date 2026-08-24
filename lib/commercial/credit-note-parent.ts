/**
 * Who and what a credit note is against.
 *
 * A credit note hangs off exactly one parent — a POS sale or an invoice — and
 * almost everything downstream needs the same two facts from it: which customer
 * to address, and which document to quote. Before invoices were allowed as a
 * source every one of those places reached straight through `creditNote.sale`,
 * so this exists to give them a single answer that works for either.
 *
 * The "exactly one" part cannot be a database constraint: SQLite has no way to
 * add a CHECK to an existing table, so both columns are nullable and the
 * invariant is asserted in application code at the point of creation.
 */

export type ParentClient = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
} | null;

type SaleParent = {
  saleNumber: string;
  client?: ParentClient;
} | null;

type InvoiceParent = {
  invoiceNumber: string;
  client?: ParentClient;
  // A repair invoice often carries no client of its own — the customer is on
  // the job it was raised from.
  job?: { jobNumber?: string | null; client?: ParentClient } | null;
} | null;

export type CreditNoteParent = {
  kind: "sale" | "invoice" | "orphan";
  /** The parent's own number, e.g. "EIS/INV/2026/0044". Empty when orphaned. */
  reference: string;
  /** Ready to print or send, e.g. "Invoice: EIS/INV/2026/0044". */
  label: string;
  /** Who to address the document to. */
  client: ParentClient;
  /** Customer name with a sensible fallback, for table rows and PDFs. */
  clientName: string;
};

export function creditNoteParent(creditNote: {
  sale?: SaleParent;
  invoice?: InvoiceParent;
}): CreditNoteParent {
  const { sale, invoice } = creditNote;

  if (invoice) {
    const client = invoice.client ?? invoice.job?.client ?? null;
    return {
      kind: "invoice",
      reference: invoice.invoiceNumber,
      label: `Invoice: ${invoice.invoiceNumber}`,
      client,
      clientName: client?.fullName ?? "No customer",
    };
  }

  if (sale) {
    const client = sale.client ?? null;
    return {
      kind: "sale",
      reference: sale.saleNumber,
      label: `Sale: ${sale.saleNumber}`,
      client,
      // POS sales are frequently anonymous, and "Walk-in" is what the rest of
      // the app calls that customer.
      clientName: client?.fullName ?? "Walk-in",
    };
  }

  // Both parents gone. Only reachable if a sale or invoice was hard-deleted,
  // which the delete guards now prevent — but the document should still render
  // rather than throw.
  return { kind: "orphan", reference: "", label: "", client: null, clientName: "Unknown" };
}

/**
 * The value a set of returned lines is worth to the customer.
 *
 * The gross line value is NOT it: the parent's total is net of any document
 * discount and inclusive of tax, so crediting gross both refuses to fully
 * return a discounted document (gross exceeds the total, so the cap rejects it)
 * and over-refunds a partial return of one. Pro-rating the parent total by the
 * share being returned carries the discount and the tax along with it, and a
 * full return lands exactly on the parent total.
 *
 * `parentSubtotal` is the gross the share is measured against: `Sale.subtotal`
 * for a sale, and the sum of `InvoiceLine.lineTotal` for an invoice, which
 * stores no subtotal of its own.
 */
export function creditValueForReturn(params: {
  grossReturned: number;
  parentSubtotal: number;
  parentTotal: number;
  round: (value: number) => number;
}): number {
  const { grossReturned, parentSubtotal, parentTotal, round } = params;
  if (grossReturned <= 0) return 0;
  // No usable subtotal (legacy or zero row) — fall back to gross rather than
  // crediting nothing at all.
  if (!Number.isFinite(parentSubtotal) || parentSubtotal <= 0) return round(grossReturned);
  const share = Math.min(1, grossReturned / parentSubtotal);
  return round(parentTotal * share);
}
