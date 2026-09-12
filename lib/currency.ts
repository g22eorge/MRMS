const ZERO_DECIMAL = new Set(["UGX", "JPY", "KRW"]);

export const SUPPORTED_CURRENCIES = [
  "UGX",
  "USD",
  "EUR",
  "GBP",
  "KES",
  "TZS",
  "RWF",
  "CDF",
  "ETB",
  "ZAR",
  "NGN",
  "GHS",
  "EGP",
  "MAD",
  "AED",
  "SAR",
  "QAR",
  "INR",
  "CNY",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/** Decimal places for a currency's minor unit (0 for UGX/JPY/KRW, else 2). */
export function currencyDecimals(currency: string) {
  return ZERO_DECIMAL.has((currency ?? "").toUpperCase()) ? 0 : 2;
}

/**
 * Round a monetary amount to its currency's minor unit. Prevents fractional
 * totals on zero-decimal currencies (e.g. a UGX total of 29,653.4 that a
 * whole-shilling payment can never reach, stranding the sale as unpayable).
 */
export function roundMoney(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return 0;
  const factor = 10 ** currencyDecimals(currency);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export function normalizeCurrency(value: unknown, fallback: string) {
  const raw = typeof value === "string" ? value : "";
  const next = raw.toUpperCase().trim();
  return next || fallback;
}

export function parseSupportedCurrencies(raw: string | null | undefined, fallback: string): SupportedCurrency[] {
  const tokens = String(raw ?? "")
    .split(",")
    .map((t) => t.toUpperCase().trim())
    .filter(Boolean);

  const unique: SupportedCurrency[] = [];
  for (const t of tokens) {
    if (!isSupportedCurrency(t)) continue;
    if (!unique.includes(t)) unique.push(t);
  }

  if (unique.length > 0) return unique;
  const fb = normalizeCurrency(fallback, "UGX");
  return isSupportedCurrency(fb) ? [fb] : ["UGX"];
}

export function toBaseAmount(params: {
  amount: number;
  currency: string | null;
  baseCurrency: string;
  exchangeRateToBase: number | null;
}) {
  const amount = Number(params.amount);
  if (!Number.isFinite(amount)) return 0;

  const currency = normalizeCurrency(params.currency, params.baseCurrency);
  if (currency === params.baseCurrency) return amount;
  const rate = Number(params.exchangeRateToBase);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return amount * rate;
}

export function getAppCurrency() {
  const value = (process.env.APP_CURRENCY ?? "UGX").toUpperCase().trim();
  return value || "UGX";
}

export function formatMoney(amount: number, currency = getAppCurrency()) {
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const number = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${currency} ${number}`;
}

export function formatMoneyCompact(amount: number, currency = getAppCurrency()) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1).replace(/\.0$/, "");
    return `${sign}${currency} ${val}M`;
  }
  if (abs >= 1_000) {
    const val = (abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1).replace(/\.0$/, "");
    return `${sign}${currency} ${val}K`;
  }
  return formatMoney(amount, currency);
}

/**
 * Read a document's currency and its exchange rate from submitted form data.
 *
 * One helper because the rule has to be identical everywhere: a document in the
 * organisation's own currency stores no rate, and a document in any other
 * currency cannot be saved without one. Getting that inconsistent is how a
 * foreign-currency document ends up unconvertible — the state `toBaseAmount`
 * scores as zero, which silently drops it out of every total that matters.
 *
 * The rate is units of BASE per 1 unit of the document currency: quoting USD
 * 100 for a UGX business at 3,750 stores rate 3750, and the base value is
 * 375,000. That direction is chosen because it is the one people quote aloud.
 *
 * Returns an error string rather than throwing, so a call site can redirect
 * with a message the person can act on instead of showing a stack trace.
 */
export function readCurrencyAndRate(input: {
  currency: unknown;
  exchangeRate: unknown;
  baseCurrency: string;
}): { currency: string; exchangeRateToBase: number | null; error?: string } {
  const currency = normalizeCurrency(input.currency, input.baseCurrency);

  if (!isSupportedCurrency(currency)) {
    return { currency: input.baseCurrency, exchangeRateToBase: null, error: `${currency} is not a supported currency.` };
  }

  // Base currency: no rate, and any submitted rate is discarded rather than
  // stored. A stored rate of 1 and a stored null must not both mean "base", or
  // every reader has two cases to handle forever.
  if (currency === input.baseCurrency) {
    return { currency, exchangeRateToBase: null };
  }

  const raw = String(input.exchangeRate ?? "").replace(/,/g, "").trim();
  if (!raw) {
    return { currency, exchangeRateToBase: null, error: `Enter the exchange rate: how many ${input.baseCurrency} to 1 ${currency}.` };
  }
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { currency, exchangeRateToBase: null, error: `The exchange rate must be a number greater than zero.` };
  }
  return { currency, exchangeRateToBase: rate };
}

/**
 * Base-currency value of a row that carries its own currency and rate.
 *
 * A thin wrapper over toBaseAmount for the common shape, so reporting code
 * reads as one line and nobody is tempted to sum `.amount` directly — which is
 * exactly how the cash-flow report came to add dollars to shillings.
 */
export function rowToBase(
  row: { amount: number; currency?: string | null; exchangeRateToBase?: number | null },
  baseCurrency: string,
) {
  return toBaseAmount({
    amount: row.amount,
    currency: row.currency ?? baseCurrency,
    baseCurrency,
    exchangeRateToBase: row.exchangeRateToBase ?? null,
  });
}

/**
 * The rate a foreign supplier payment was actually settled at.
 *
 * Not a looked-up rate. What a business pays to move money abroad is the bank's
 * or bureau's rate plus a spread, and no public feed publishes that — recording
 * an interbank rate would make the books disagree with the bank statement while
 * looking authoritative, which is worse than not converting at all.
 *
 * The truth is on the statement: this much left the account, of which this much
 * was charges, and the supplier was credited this much. The rate falls out of
 * those three, and it carries the spread with it automatically.
 *
 *   sent 3,880,000 UGX, of which 30,000 was fees, supplier credited 1,000 AED
 *   → 3,850 UGX per AED
 *
 * Returns null when it cannot be derived, so callers keep whatever rate was
 * entered by hand rather than silently storing a wrong one.
 */
export function effectiveRateFromSettlement(input: {
  /** What the supplier was credited, in the foreign currency. */
  amount: number;
  /** Total that left the account in base currency, fees included. */
  baseAmountSent: number | null | undefined;
  /** Charges in base currency, already part of baseAmountSent. */
  feeAmount?: number | null;
}): number | null {
  const amount = Number(input.amount);
  const sent = Number(input.baseAmountSent);
  const fee = Number(input.feeAmount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isFinite(sent) || sent <= 0) return null;
  const net = sent - (Number.isFinite(fee) ? fee : 0);
  if (!(net > 0)) return null;
  return net / amount;
}

/**
 * How far a settled rate sat from a reference rate, as a percentage.
 *
 * For watching spread rather than for converting anything. A business moving
 * money to AED and RMB suppliers regularly wants to see that one transfer cost
 * 3% over the reference and another 9%; that comparison is what reduces
 * variation, not pinning the books to a feed nobody transacted at.
 *
 * Positive means the settlement cost more base currency than the reference.
 */
export function ratePremiumPct(settledRate: number, referenceRate: number): number | null {
  if (!Number.isFinite(settledRate) || settledRate <= 0) return null;
  if (!Number.isFinite(referenceRate) || referenceRate <= 0) return null;
  return ((settledRate - referenceRate) / referenceRate) * 100;
}
