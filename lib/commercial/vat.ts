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
