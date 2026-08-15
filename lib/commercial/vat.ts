/**
 * Shared VAT computation for sales/receipts.
 *
 * VAT is fully org-configurable via DocumentBrandingSettings:
 *   - vatDefaultApplicable: whether new sales charge VAT at all (default OFF)
 *   - vatRatePercent:       the rate, e.g. 18
 *   - vatInclusive:         whether item prices already include VAT
 *
 * This helper is pure and rounding-agnostic — callers round the returned
 * amounts to the currency's minor unit with their own roundMoney().
 */
export type VatConfig = {
  applicable: boolean;
  ratePercent: number;
  inclusive: boolean;
};

export function computeVat(
  taxable: number,
  { applicable, ratePercent, inclusive }: VatConfig,
): { vatAmount: number; totalAmount: number } {
  const rate = Math.max(0, ratePercent) / 100;
  const base = Math.max(0, taxable);

  if (!applicable || rate <= 0 || base <= 0) {
    return { vatAmount: 0, totalAmount: base };
  }

  if (inclusive) {
    // Prices already include VAT: don't inflate the total, just surface the
    // embedded tax portion for the receipt.
    const net = base / (1 + rate);
    return { vatAmount: base - net, totalAmount: base };
  }

  // Prices exclude VAT: add it on top.
  const vatAmount = base * rate;
  return { vatAmount, totalAmount: base + vatAmount };
}

/** One line's tax inputs for per-product VAT. */
export type VatLineInput = {
  base: number; // line gross (lineTotal), before any document-level discount
  taxable: boolean; // does this line bear tax at all?
  ratePercent?: number | null; // per-line rate; falls back to the org default when null
};

/**
 * Per-line VAT: each line is taxed at its own product rate (exempt lines at 0),
 * with a document-level discount pro-rated across lines by value share.
 *
 * This generalises {@link computeVat}: when every line is taxable at the same
 * rate it returns exactly the same subtotal/vat/total as applying one rate to
 * the whole discounted subtotal, so orgs with a single rate see no change.
 * Pure and rounding-agnostic — callers round with their own roundMoney().
 */
export function computeLinesVat(
  lines: VatLineInput[],
  {
    applicable,
    defaultRatePercent,
    inclusive,
    discountAmount = 0,
  }: { applicable: boolean; defaultRatePercent: number; inclusive: boolean; discountAmount?: number },
): { subtotal: number; discountAmount: number; vatAmount: number; totalAmount: number } {
  const subtotal = lines.reduce((sum, line) => sum + Math.max(0, line.base), 0);
  const discount = Math.max(0, Math.min(discountAmount, subtotal));

  let vatAmount = 0;
  for (const line of lines) {
    const base = Math.max(0, line.base);
    if (base <= 0) continue;
    // Allocate the document discount to this line by its share of the subtotal.
    const lineDiscount = subtotal > 0 ? discount * (base / subtotal) : 0;
    const lineBase = Math.max(0, base - lineDiscount);
    const rate = line.taxable ? (line.ratePercent ?? defaultRatePercent) : 0;
    vatAmount += computeVat(lineBase, { applicable, ratePercent: rate, inclusive }).vatAmount;
  }

  const netBase = Math.max(0, subtotal - discount);
  // Inclusive prices already embed tax, so the total is just the discounted
  // gross; exclusive prices add the summed tax on top.
  const totalAmount = inclusive ? netBase : netBase + vatAmount;
  return { subtotal, discountAmount: discount, vatAmount, totalAmount };
}
