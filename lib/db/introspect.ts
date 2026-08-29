import { prisma } from "@/lib/prisma";

/**
 * Schema introspection that works on both database engines.
 *
 * Four runtime paths ask the database about its own shape — branding settings,
 * the org WhatsApp config, technician payout columns and the platform health
 * check. They exist because this system has repeatedly met a production
 * database running behind its own schema, and asking first is what turns a
 * 500 into a degraded-but-working page.
 *
 * They asked in SQLite's dialect: `PRAGMA table_info(...)` and a lookup in
 * `sqlite_master`. Neither exists in PostgreSQL — both throw. Every one of
 * those call sites wraps the query in a catch that returns "no columns" or
 * "table absent", so on Postgres the failure would not surface as an error.
 * It would surface as the branding table looking permanently empty, payouts
 * looking permanently unavailable, and the health check reporting every table
 * missing. Wrong answers, quietly, from code written to prevent exactly that.
 *
 * One module knows the dialect instead, matching lib/db/search.ts: call sites
 * ask the question, this decides how to ask it.
 */

const IS_POSTGRES = /^postgres(ql)?:\/\//i.test(
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
);

/** Which dialect introspection will use. Exposed so health output can say so. */
export function introspectionDialect() {
  return IS_POSTGRES ? "postgres" : "sqlite";
}

/**
 * The column names on a table, or an empty set when it cannot be read.
 *
 * Empty means "could not tell", which every caller already treats as "assume
 * the columns are missing and degrade" — the safe direction, and the behaviour
 * they had before.
 */
export async function tableColumns(table: string): Promise<Set<string>> {
  try {
    if (IS_POSTGRES) {
      // information_schema is case-sensitive on the stored name, and Prisma
      // creates these tables quoted, so the name is matched exactly as given.
      const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = $1`,
        table,
      );
      return new Set(rows.map((r) => r.column_name));
    }
    // PRAGMA takes no bind parameters, so the name is inlined — safe only
    // because every caller passes a literal from its own source.
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info(${JSON.stringify(table)})`,
    );
    return new Set(rows.map((r) => r.name));
  } catch {
    return new Set();
  }
}

/** True when the table is present. False on any error, as before. */
export async function tableExists(table: string): Promise<boolean> {
  try {
    if (IS_POSTGRES) {
      const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
        `SELECT COUNT(*)::int AS n FROM information_schema.tables
          WHERE table_schema = current_schema() AND table_name = $1`,
        table,
      );
      return Number(rows[0]?.n ?? 0) > 0;
    }
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      table,
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Add a column if it is absent.
 *
 * `ADD COLUMN IF NOT EXISTS` is PostgreSQL-only; SQLite has no such form and
 * errors on a duplicate, which is why the SQLite path checks first and still
 * swallows the race. The type and default are the caller's own literals — this
 * takes no user input and must never be given any.
 */
export async function addColumnIfMissing(
  table: string,
  column: string,
  type: string,
  defaultExpr?: string,
): Promise<boolean> {
  const dflt = defaultExpr ? ` DEFAULT ${defaultExpr}` : "";
  try {
    if (IS_POSTGRES) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}${dflt}`,
      );
      return true;
    }
    const cols = await tableColumns(table);
    if (cols.has(column)) return false;
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}${dflt}`,
    );
    return true;
  } catch {
    // Another request adding the same column at the same moment is the common
    // case here, and it is harmless: the column ends up present either way.
    return false;
  }
}
