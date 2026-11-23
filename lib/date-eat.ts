const EAT_LOCALE = "en-GB";
const EAT_TIMEZONE = "Africa/Nairobi";

/**
 * The calendar date in East Africa Time, as "YYYY-MM-DD".
 *
 * For date inputs, export file names and anywhere else a day is needed as
 * text. `toISOString().slice(0, 10)` gives the UTC day, which is yesterday
 * between midnight and 03:00 here: a form opened at 00:30 defaulted to the
 * previous date and its `max` refused today's, and a payment taken at 01:00
 * was listed under the day before. Works in the browser as well as on the
 * server, and does not depend on either one's own time zone.
 */
export function eatDateKey(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EAT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

/**
 * The instants a calendar day starts and ends in East Africa Time, from a
 * "YYYY-MM-DD" key such as a date input's value. Null for anything else.
 *
 * `new Date("2026-11-23")` is midnight UTC, which is 03:00 here, so a filter
 * built from it starts three hours into the day; and using the same instant as
 * the upper bound leaves out the whole of the last day.
 */
export function eatDayStart(key: string | null | undefined): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00.000+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function eatDayEnd(key: string | null | undefined): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T23:59:59.999+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The hour of the day in East Africa Time, 0-23. */
export function eatHour(value: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: EAT_TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(value);
  return Number(hour) % 24;
}

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
