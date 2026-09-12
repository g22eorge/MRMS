/**
 * Amount in words, for the line a receipt carries under its total.
 *
 * Written out, an amount cannot be altered by adding a digit — which is the
 * whole reason receipts and cheques have carried it for as long as either has
 * existed, and why a customer in Uganda expects to see it. The figure above it
 * stays authoritative; this is the check on it.
 *
 * Short scale (thousand, million, billion), which is what Ugandan and East
 * African commercial practice uses.
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

/** 1-999 in words. Callers handle zero, which has no place inside a group. */
function underThousand(n: number): string {
  if (n >= 100) {
    const rest = n % 100;
    return `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` and ${underThousand(rest)}` : ""}`;
  }
  if (n >= 20) {
    const rest = n % 10;
    return `${TENS[Math.floor(n / 10)]}${rest ? `-${ONES[rest]}` : ""}`;
  }
  return ONES[n];
}

/** A whole number in words. Negative and fractional parts are the caller's. */
export function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";

  // Split into three-digit groups from the right, so each group carries a scale.
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  if (groups.length > SCALES.length) return String(n);

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (groups[i] === 0) continue;
    parts.push(`${underThousand(groups[i])}${SCALES[i] ? ` ${SCALES[i]}` : ""}`);
  }
  return parts.join(" ");
}

/**
 * The full line, e.g. "Ugandan Shillings Four Hundred Thousand Only".
 *
 * The currency is named rather than shown as a code, because a code is what the
 * figure above already gives and the point of this line is to say the same
 * thing a different way. Unknown currencies keep their code, which is honest;
 * inventing a name for one would be worse than not translating it.
 *
 * Minor units are included only when the amount actually has them: "and 50
 * Cents" on a round figure is noise, and UGX has no circulating subunit at all.
 */
const CURRENCY_NAMES: Record<string, { major: string; minor: string }> = {
  UGX: { major: "Ugandan Shillings", minor: "Cents" },
  KES: { major: "Kenyan Shillings", minor: "Cents" },
  TZS: { major: "Tanzanian Shillings", minor: "Cents" },
  RWF: { major: "Rwandan Francs", minor: "Centimes" },
  USD: { major: "US Dollars", minor: "Cents" },
  EUR: { major: "Euros", minor: "Cents" },
  GBP: { major: "Pounds Sterling", minor: "Pence" },
};

export function amountInWords(amount: number, currency: string): string {
  const code = (currency || "UGX").toUpperCase();
  const names = CURRENCY_NAMES[code] ?? { major: code, minor: "Cents" };

  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const whole = Math.floor(absolute);
  // Rounded, not truncated: 0.005 short of a unit should read as the unit, the
  // same way the formatted figure beside it rounds.
  const minor = Math.round((absolute - whole) * 100);
  // That rounding can carry — 12.999 gives whole 12 and minor 100.
  const carried = minor === 100;
  const majorValue = carried ? whole + 1 : whole;
  const minorValue = carried ? 0 : minor;

  const head = `${names.major} ${numberToWords(majorValue)}`;
  const tail = minorValue > 0 ? ` and ${numberToWords(minorValue)} ${names.minor}` : "";
  return `${negative ? "Minus " : ""}${head}${tail} Only`;
}
