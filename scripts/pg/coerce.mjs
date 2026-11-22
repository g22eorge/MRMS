/**
 * Shared coercion for values read out of a SQLite/Turso dump.
 *
 * SQLite has no date or boolean type, and this project's databases do not even
 * agree on a convention: the production snapshot holds ISO-8601 text because
 * Prisma wrote it that way, `prisma/dev.db` holds integer epoch milliseconds,
 * and rows written by the old hand-written DDL hold `"YYYY-MM-DD HH:MM:SS"`
 * from SQLite's `CURRENT_TIMESTAMP`.
 *
 * All three appear in the same column in places. That mixture caused three
 * separate bugs while this tooling was being written — a three-hour timezone
 * shift, a millisecond truncation, and a min/max inversion — each in a different
 * script that had its own copy of the parsing. Hence one implementation.
 */

/**
 * A SQLite timestamp value as epoch milliseconds, or null.
 *
 * @param {unknown} value
 * @param {string} [context] included in the error when parsing fails
 */
export function toEpochMs(value, context = "timestamp") {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "bigint" || typeof value === "number") return Number(value);

  const text = String(value).trim();
  if (!text) return null;

  // Integer epoch milliseconds stored as text.
  if (/^\d{10,}$/.test(text)) return Number(text);

  // "2026-05-25 11:10:00" — SQLite's CURRENT_TIMESTAMP, which is UTC. Read
  // without the zone marker, `new Date` would treat it as local time and shift
  // every such row by the host's offset.
  const normalised = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)
    ? `${text.replace(" ", "T")}Z`
    : text;

  const ms = new Date(normalised).getTime();
  if (Number.isNaN(ms)) throw new Error(`${context}: cannot parse timestamp ${JSON.stringify(value)}`);
  return ms;
}

/** The same value as a Date, for writing through Prisma. */
export function toDate(value, context = "timestamp") {
  const ms = toEpochMs(value, context);
  return ms === null ? null : new Date(ms);
}

/** SQLite stores booleans as 0/1. */
export function toBoolean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  return Number(value) !== 0;
}
