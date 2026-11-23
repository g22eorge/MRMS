/**
 * Calendar arithmetic in a named time zone, independent of the clock the
 * process or the browser is on.
 *
 * The app runs on East Africa Time, which is right for every business in
 * Uganda and Kenya. A business elsewhere has its own midnight: for a shop in
 * Accra, "today" starts three hours after Kampala's. Each organisation carries
 * a time zone, and these helpers answer "what day is it there" and "when did
 * that day start" for it. No daylight-saving table is needed: the offset is
 * read from the platform's own zone data for the instant in question.
 */
export const DEFAULT_ZONE = "Africa/Kampala";

export function isValidZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function zoneOrDefault(zone: string | null | undefined): string {
  return isValidZone(zone) ? zone : DEFAULT_ZONE;
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock date and time in `zone` at the instant `at`. Month is 1-12. */
export function zonedParts(at: Date, zone: string = DEFAULT_ZONE): Parts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zoneOrDefault(zone),
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short",
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: Math.max(0, WEEKDAYS.indexOf(get("weekday"))),
  };
}

/** Minutes `zone` is ahead of UTC at the instant `at` (Kampala: 180). */
export function zoneOffsetMinutes(at: Date, zone: string = DEFAULT_ZONE): number {
  const p = zonedParts(at, zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** The instant a wall-clock date and time occurs in `zone`. */
export function zonedInstant(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0, zone: string = DEFAULT_ZONE): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  // Offset at the guess, then again at the corrected instant: one pass is
  // wrong only inside a daylight-saving changeover, the second settles it.
  let instant = new Date(guess.getTime() - zoneOffsetMinutes(guess, zone) * 60_000);
  instant = new Date(guess.getTime() - zoneOffsetMinutes(instant, zone) * 60_000);
  return instant;
}

/** Midnight at the start of the day containing `at`, in `zone`. */
export function zonedStartOfDay(at: Date, zone: string = DEFAULT_ZONE): Date {
  const p = zonedParts(at, zone);
  return zonedInstant(p.year, p.month, p.day, 0, 0, 0, 0, zone);
}

/** Midnight on the 1st of the month containing `at`, in `zone`. */
export function zonedStartOfMonth(at: Date, zone: string = DEFAULT_ZONE): Date {
  const p = zonedParts(at, zone);
  return zonedInstant(p.year, p.month, 1, 0, 0, 0, 0, zone);
}

/** "YYYY-MM-DD" for the day containing `at`, in `zone`. */
export function zonedDateKey(at: Date, zone: string = DEFAULT_ZONE): string {
  const p = zonedParts(at, zone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Zones offered when setting a business's time zone. Any valid IANA name is accepted. */
export const COMMON_ZONES: Array<{ zone: string; label: string }> = [
  { zone: "Africa/Kampala", label: "Kampala, Nairobi, Dar es Salaam (UTC+3)" },
  { zone: "Africa/Kigali", label: "Kigali, Lusaka, Harare (UTC+2)" },
  { zone: "Africa/Johannesburg", label: "Johannesburg (UTC+2)" },
  { zone: "Africa/Lagos", label: "Lagos, Kinshasa (UTC+1)" },
  { zone: "Africa/Accra", label: "Accra, Abidjan, Dakar (UTC+0)" },
  { zone: "Africa/Cairo", label: "Cairo (UTC+2/+3)" },
  { zone: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { zone: "Europe/London", label: "London (UTC+0/+1)" },
];
