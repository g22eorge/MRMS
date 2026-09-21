import { Prisma } from "@prisma/client";

/**
 * "Is this error the database telling us a table or column does not exist?"
 *
 * Several call sites degrade gracefully when a relation is missing — the POS
 * screen shows a setup banner instead of a stack trace, the outbox falls back to
 * sending without logging. They each did this by matching the string
 * `"no such table"`, which is SQLite's wording. Postgres says
 * `relation "Sale" does not exist`, so every one of those checks would have
 * silently stopped matching and the graceful path would have become an
 * exception — the kind of migration bug that only shows up in front of a user.
 *
 * Prisma's error codes are the reliable signal; the string match stays as a
 * fallback for errors raised through `$queryRaw`, which arrive as P2010 with the
 * driver's message inside.
 */

/** Table/relation missing. */
export function isMissingTableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return true;
  const message = String(
    error instanceof Error ? error.message : error,
  ).toLowerCase();
  return (
    message.includes("no such table")                 // SQLite
    || /relation ".*" does not exist/.test(message)    // Postgres
    || message.includes("undefined_table")
  );
}

/** Column missing. */
export function isMissingColumnError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") return true;
  const message = String(
    error instanceof Error ? error.message : error,
  ).toLowerCase();
  return (
    message.includes("no such column")                // SQLite
    || /column ".*" does not exist/.test(message)      // Postgres
    || message.includes("undefined_column")
  );
}

/** Either — for call sites that only care that the schema is behind. */
export function isMissingSchemaError(error: unknown): boolean {
  return isMissingTableError(error) || isMissingColumnError(error);
}
