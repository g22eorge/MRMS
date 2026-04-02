const ZERO_DECIMAL = new Set(["UGX", "JPY", "KRW"]);

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
