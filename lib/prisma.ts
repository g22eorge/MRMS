import { Prisma, PrismaClient } from "@prisma/client";
import type { Operation } from "@prisma/client/runtime/library";

import { decimalToNumberExtension } from "./prisma-decimal";

/**
 * The Prisma client.
 *
 * This module used to be 382 lines, almost all of it working around SQLite:
 * a libsql/Turso driver adapter, `file:` URL normalisation for three different
 * working directories, a stale-client guard listing nineteen model names by
 * hand, four query extensions that caught `"no such column"` errors and issued
 * `ALTER TABLE` mid-query, and `ensureMoneySchema()` — 90 lines of SQLite DDL
 * run before every money write because production databases predated the
 * accounting tables. Migrations replace all of it.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Interactive transactions here bundle several queries (document-number
 * allocation scans, cash-basis ledger posts, receipt/invoice creation). Prisma's
 * default 5000 ms ceiling is too tight for that class, so raise it centrally.
 */
const TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

function isDecimal(value: unknown): value is Prisma.Decimal {
  return Prisma.Decimal.isDecimal(value);
}

/**
 * Converts every `Decimal` in a query result to a plain number, in place.
 *
 * Money is stored as exact `numeric` in Postgres, but the application reads it
 * as `number`. That boundary is deliberate. Prisma hands back `Prisma.Decimal`
 * objects, and in JavaScript `decimalA + decimalB` concatenates their string
 * forms instead of throwing — so a single missed arithmetic site among the ~3150
 * money references in this codebase would produce a plausible wrong total with
 * no exception and no failing test. Converting once, here, makes that class of
 * bug impossible rather than merely unlikely.
 *
 * What this keeps: exact storage, and exact arithmetic for any SUM/AVG Postgres
 * performs. What it does not claim: exact arithmetic in JavaScript. For UGX,
 * whose amounts are whole shillings well inside float64's exact integer range,
 * that is precise; computed fractions (VAT, percentage discounts) are rounded
 * for display anyway.
 *
 * Mutates rather than rebuilding: query results are freshly allocated per call
 * and owned by the caller, so there is nothing to preserve.
 */
function decimalsToNumbers(value: unknown, depth = 0): unknown {
  // Guards against a pathological cycle; Prisma results are trees in practice.
  if (value === null || value === undefined || depth > 12) return value;
  if (isDecimal(value)) return value.toNumber();
  if (typeof value !== "object") return value;
  // Leave the opaque types alone.
  if (value instanceof Date || value instanceof Uint8Array) return value;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = decimalsToNumbers(value[i], depth + 1);
    }
    return value;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    record[key] = decimalsToNumbers(record[key], depth + 1);
  }
  return record;
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    // Prefer a clear message over Prisma's generic initialisation error.
    throw new Error("Missing DATABASE_URL (set the Postgres connection string)");
  }

  return new PrismaClient({
    log: ["error", "warn"],
    transactionOptions: TRANSACTION_OPTIONS,
  });
}

/**
 * Next's dev server re-imports modules while the process lives on, so a client
 * generated before a schema change can survive in the module global and then
 * fail on a model it does not know about. Comparing the cached client's
 * delegates against the current datamodel catches that generically — the
 * previous version of this check listed nineteen model names by hand and had to
 * be edited every time a model was added.
 */
function isStaleSingleton(client: PrismaClient | undefined): boolean {
  if (!client) return false;
  const delegates = client as unknown as Record<string, unknown>;
  return Prisma.dmmf.datamodel.models.some((model) => {
    const key = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    return !delegates[key];
  });
}

if (isStaleSingleton(globalForPrisma.prisma)) {
  try { void globalForPrisma.prisma?.$disconnect(); } catch { /* ignore */ }
  globalForPrisma.prisma = undefined;
}

const basePrisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

/**
 * Two layers, because they cover different things.
 *
 * The `result` extension is the important one: it changes each Decimal field's
 * *declared type* as well as its value, so the generated types and the code
 * agree that money is a `number`. It only applies to model reads, though.
 *
 * The `query` extension catches what the first cannot see: aggregate results
 * (`_sum`, `_avg`, `_min`, `_max`), `groupBy`, and `$queryRaw`, all of which
 * hand back Decimals that no field mapping covers.
 */
export const prisma = basePrisma
  .$extends({
    query: {
      async $allOperations({ args, query }) {
        return decimalsToNumbers(await query(args));
      },
    },
  })
  .$extends(decimalToNumberExtension);

// Eagerly start the connection so it is ready before the first request.
// Without this, Prisma's lazy initialiser races incoming requests (especially
// better-auth session checks) and throws "Engine is not yet connected".
void basePrisma.$connect().catch(() => {/* errors surface on first query */});

/**
 * The application's client type, and the transaction-scoped variant.
 *
 * Helpers that accept "either the global client or a transaction client" must
 * be typed against these rather than `PrismaClient` / `Prisma.TransactionClient`:
 * an extended client is a structurally different type, so the generated
 * built-ins do not accept it.
 */
export type Db = typeof prisma;

export type TxClient = Omit<
  Db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Extension-aware row type.
 *
 * `Prisma.JobGetPayload<...>` and friends are generated from the datamodel and
 * know nothing about client extensions, so they still describe money as
 * `Decimal` even though every read goes through the conversion above. Deriving
 * the row type from the delegate keeps the declared type and the value in step.
 *
 *   type JobRow = Row<typeof prisma.job, { select: typeof jobListSelect }>;
 */
export type Row<
  Delegate,
  Args,
  Op extends Operation = "findFirstOrThrow",
> = Prisma.Result<Delegate, Args, Op>;
