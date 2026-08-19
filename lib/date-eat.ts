const EAT_LOCALE = "en-GB";
const EAT_TIMEZONE = "Africa/Nairobi";

export function formatEATDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(EAT_LOCALE, { timeZone: EAT_TIMEZONE });
}

export function formatEATDateTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(EAT_LOCALE, { timeZone: EAT_TIMEZONE });
}

/** Short document date: "12 Jan 25" — used in PDF headers. */
export function formatEATDocDate(value: Date): string {
  return value.toLocaleDateString(EAT_LOCALE, {
    day: "2-digit", month: "short", year: "2-digit",
    timeZone: EAT_TIMEZONE,
  });
}

export function formatEATMonthLabel(year: number, month: number) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(EAT_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: EAT_TIMEZONE,
  });
}

/** List/table date: "15 Jan" (no year). */
export function formatEATShortDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(EAT_LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: EAT_TIMEZONE,
  });
}

/** List/table date with year: "15 Jan 2025". */
export function formatEATMediumDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(EAT_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: EAT_TIMEZONE,
  });
}

/** Time only in EAT: "14:30". */
export function formatEATTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(EAT_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: EAT_TIMEZONE,
  });
}

/**
 * Elapsed-time label for staleness badges ("no update 6h", "no update 11d").
 * Hours alone stop being readable past a day — "283h" makes the reader divide.
 */
export function formatElapsedHours(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return "0h";
  if (hours < 48) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Parse a ?year= / ?month= query value, falling back when it is not a number.
 * Without this, "abc" became NaN -> Invalid Date -> a report that rendered with
 * no figures at all, which reads as "you earned nothing" rather than an error.
 */
export function parsePeriodInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
