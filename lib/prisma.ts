import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const DEFAULT_LOCAL_DATABASE_URL = (() => {
  const cwd = process.cwd();
  // Support running from `.next/standalone` where relative paths break.
  if (cwd.includes(".next/standalone")) {
    return `file:${cwd}/../../prisma/dev.db`;
  }
  return `file:${cwd}/prisma/dev.db`;
})();

function toSqliteAbsoluteUrl(url: string) {
  if (!url.startsWith("file:")) return url;
  const rawPath = url.slice("file:".length);
  if (!rawPath || rawPath.startsWith("/") || rawPath.startsWith("..")) return url;

  // Avoid path/process.cwd() here to prevent Turbopack over-tracing.
  // Dev scripts already run prisma db push/generate before dev/build.
  if (rawPath === "dev.db" || rawPath === "./dev.db" || rawPath === "prisma/dev.db" || rawPath === "./prisma/dev.db") {
    return DEFAULT_LOCAL_DATABASE_URL;
  }

  return url;
}

// Interactive transactions here bundle several queries (document-number
// allocation scans, cash-basis ledger posts, receipt/invoice creation). Over
// Turso/libSQL every round-trip carries network latency, so Prisma's default
// 5000 ms transaction ceiling is too tight and trips "Transaction already
// closed" errors. Give the whole class more headroom centrally.
const TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

function createPrismaClient() {
  // PostgreSQL connects through Prisma's own driver from DATABASE_URL — no
  // adapter, unlike Turso. It is checked before anything else because the rest
  // of this function assumes the engine is SQLite: it would rewrite the URL as
  // a file path and then refuse to start for want of Turso variables that a
  // Postgres deployment has no reason to set.
  //
  // Reaching this branch also requires the schema's provider to be postgresql;
  // see scripts/pg-schema.mjs, which produces that variant. A Postgres URL
  // under the sqlite provider is a misconfiguration Prisma reports itself.
  const postgresUrl = (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "").trim();
  if (/^postgres(ql)?:\/\//i.test(postgresUrl)) {
    // Accept POSTGRES_URL as the source, but the datasource reads DATABASE_URL.
    process.env.DATABASE_URL = postgresUrl;
    return new PrismaClient({
      log: ["error", "warn"],
      transactionOptions: TRANSACTION_OPTIONS,
    });
  }

  // Use TURSO_DATABASE_URL to detect production mode
  const isProduction = !!process.env.TURSO_DATABASE_URL;

  // GitHub Actions/CI runs Next in production mode but uses local sqlite.
  const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

  // When Next runs `next build`, NODE_ENV is production; allow local sqlite during build.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (
    process.env.NODE_ENV === "production" &&
    !isProduction &&
    !isBuildPhase &&
    !isCi &&
    process.env.ALLOW_SQLITE_PRODUCTION !== "1"
  ) {
    // Prefer a clear error over a noisy sqlite "unable to open" failure on serverless.
    throw new Error("Missing TURSO_DATABASE_URL (set Turso env vars for production runtime)");
  }

  if (!isProduction) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const resolved = databaseUrl
      ? toSqliteAbsoluteUrl(databaseUrl)
      : toSqliteAbsoluteUrl(DEFAULT_LOCAL_DATABASE_URL);
    process.env.DATABASE_URL = resolved;

    // No datasourceUrl here on purpose. Pointing the client at DATABASE_URL
    // while the schema literal still sends `prisma db push` to dev.db splits the
    // two halves apart: the client opens prisma/test.db, which the push never
    // created, and every database-touching test fails. They have to move
    // together, and moving them is a separate change from unblocking the build.
    return new PrismaClient({
      log: ["error", "warn"],
      transactionOptions: TRANSACTION_OPTIONS,
    });
  }

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("Missing TURSO_DATABASE_URL");
  }

  // The datasource reads env("DATABASE_URL"), and production sets only the
  // Turso variables. The adapter below is what actually connects, so this value
  // is never dialled — it exists so the schema's env reference resolves rather
  // than failing construction on a variable nothing here uses.
  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = DEFAULT_LOCAL_DATABASE_URL;
  }

  const adapter = new PrismaLibSql({
    url,
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  });

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
    transactionOptions: TRANSACTION_OPTIONS,
  });
}

// If a cached singleton is missing recently-added models (stale hot-reload cache),
// discard it so a fresh client is created with the current generated schema.
function isStaleSingleton(client: PrismaClient | undefined): boolean {
  if (!client) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  return !c.complaint
    || !c.userGroup
    || !c.branch
    || !c.supplier
    || !c.salesTarget
    || !c.stockLocation
    || !c.stockTransfer
    || !c.purchaseRequest
    || !c.goodsReceived
    || !c.supplierBill
    || !c.supplierPayment
    || !c.stockCount
    || !c.taxRate
    || !c.expense
    || !c.recurringInvoice
    || !c.chartOfAccount
    || !c.journalEntry
    || !c.bankAccount
    || !c.campaign;
}

if (isStaleSingleton(globalForPrisma.prisma)) {
  try { void globalForPrisma.prisma?.$disconnect(); } catch { /* ignore */ }
  globalForPrisma.prisma = undefined;
}

const basePrisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

let paymentKindRepair: Promise<void> | null = null;
let leadLostReasonRepair: Promise<void> | null = null;
let clientAddressRepair: Promise<void> | null = null;
let quotationTaxRepair: Promise<void> | null = null;

function isMissingPaymentKindError(error: unknown) {
  return String(error).includes("no such column: main.Payment.kind")
    || String(error).includes("no such column: Payment.kind");
}

function isMissingLeadLostReasonError(error: unknown) {
  return String(error).includes("no such column: main.Lead.lostReason")
    || String(error).includes("no such column: Lead.lostReason")
    || String(error).includes("no such column: lostReason");
}

function isMissingClientAddressError(error: unknown) {
  return String(error).includes("no such column: main.Client.address")
    || String(error).includes("no such column: Client.address")
    || String(error).includes("no such column: address");
}

function isMissingQuotationTaxError(error: unknown) {
  return String(error).includes("no such column: main.Quotation.taxLabel")
    || String(error).includes("no such column: Quotation.taxLabel")
    || String(error).includes("no such column: taxLabel")
    || String(error).includes("no such column: main.Quotation.taxRate")
    || String(error).includes("no such column: Quotation.taxRate")
    || String(error).includes("no such column: taxRate");
}

function isDuplicateColumnError(error: unknown) {
  const message = String(error).toLowerCase();
  return message.includes("duplicate column name") || message.includes("already exists");
}

async function ensurePaymentKindColumn() {
  paymentKindRepair ??= basePrisma.$executeRawUnsafe(
    `ALTER TABLE "Payment" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'PAYMENT'`,
  ).then(
    () => undefined,
    (error) => {
      if (isDuplicateColumnError(error)) return undefined;
      paymentKindRepair = null;
      throw error;
    },
  );

  return paymentKindRepair;
}

async function ensureLeadLostReasonColumn() {
  leadLostReasonRepair ??= basePrisma.$executeRawUnsafe(
    `ALTER TABLE "Lead" ADD COLUMN "lostReason" TEXT`,
  ).then(
    () => undefined,
    (error) => {
      if (isDuplicateColumnError(error)) return undefined;
      leadLostReasonRepair = null;
      throw error;
    },
  );

  return leadLostReasonRepair;
}

async function ensureClientAddressColumn() {
  clientAddressRepair ??= basePrisma.$executeRawUnsafe(
    `ALTER TABLE "Client" ADD COLUMN "address" TEXT`,
  ).then(
    () => undefined,
    (error) => {
      if (isDuplicateColumnError(error)) return undefined;
      clientAddressRepair = null;
      throw error;
    },
  );

  return clientAddressRepair;
}

async function ensureQuotationTaxColumns() {
  quotationTaxRepair ??= (async () => {
    for (const statement of [
      `ALTER TABLE "Quotation" ADD COLUMN "taxLabel" TEXT`,
      `ALTER TABLE "Quotation" ADD COLUMN "taxRate" REAL`,
    ]) {
      try {
        await basePrisma.$executeRawUnsafe(statement);
      } catch (error) {
        if (!isDuplicateColumnError(error)) throw error;
      }
    }
  })().catch((error) => {
    quotationTaxRepair = null;
    throw error;
  });

  return quotationTaxRepair;
}

let moneySchemaRepair: Promise<void> | null = null;

/**
 * Proactively ensure every table/column the money-write transaction touches
 * exists BEFORE the transaction opens. This is deliberately NOT part of the
 * reactive query extension below: those repairs fire *inside* the failing
 * query, but on SQLite/libSQL the first failed statement aborts the whole
 * enclosing $transaction, so an in-transaction ALTER can neither recover the
 * payment nor run DDL against a connection that is holding a write lock
 * (Turso deadlocks on that). Recording a client/invoice payment now also posts
 * to the C5 cash-basis ledger (ChartOfAccount / JournalEntry / JournalLine) and
 * writes an FX rate (Payment.exchangeRateToBase) — columns/tables added after
 * some production DBs were provisioned. When any of those is missing the entire
 * payment fails with a bare "no such column/table" schema error. Running these
 * idempotent, non-transactional DDLs first keeps money-receiving working on
 * databases that predate the accounting/FX schema. Memoized: runs once per
 * process, and only re-arms on a genuine failure so a transient error can retry.
 */
export async function ensureMoneySchema(): Promise<void> {
  moneySchemaRepair ??= (async () => {
    const statements = [
      // Payment columns added after the original table (kind + FX + links).
      `ALTER TABLE "Payment" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'PAYMENT'`,
      `ALTER TABLE "Payment" ADD COLUMN "exchangeRateToBase" REAL`,
      `ALTER TABLE "Payment" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'UGX'`,
      `ALTER TABLE "Payment" ADD COLUMN "saleId" TEXT`,
      `ALTER TABLE "Payment" ADD COLUMN "createdById" TEXT`,
      `ALTER TABLE "Payment" ADD COLUMN "note" TEXT`,
      // Shared document/journal counter (RCT + JE numbers).
      `CREATE TABLE IF NOT EXISTS "DocumentSequence" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orgId" TEXT,
        "type" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "value" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "DocumentSequence_orgId_type_year_key" ON "DocumentSequence"("orgId","type","year")`,
      // C5 cash-basis ledger tables the payment/refund post depends on.
      `CREATE TABLE IF NOT EXISTS "ChartOfAccount" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orgId" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "parentId" TEXT,
        "description" TEXT,
        "isSystem" INTEGER NOT NULL DEFAULT 0,
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "ChartOfAccount_orgId_code_key" ON "ChartOfAccount"("orgId","code")`,
      `CREATE INDEX IF NOT EXISTS "ChartOfAccount_orgId_type_idx" ON "ChartOfAccount"("orgId","type")`,
      `CREATE TABLE IF NOT EXISTS "JournalEntry" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orgId" TEXT NOT NULL,
        "entryNumber" TEXT NOT NULL,
        "date" DATETIME NOT NULL,
        "description" TEXT NOT NULL,
        "reference" TEXT,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "totalAmount" REAL NOT NULL DEFAULT 0,
        "createdById" TEXT NOT NULL,
        "postedAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_orgId_entryNumber_key" ON "JournalEntry"("orgId","entryNumber")`,
      `CREATE INDEX IF NOT EXISTS "JournalEntry_orgId_date_idx" ON "JournalEntry"("orgId","date")`,
      `CREATE INDEX IF NOT EXISTS "JournalEntry_orgId_status_idx" ON "JournalEntry"("orgId","status")`,
      `CREATE TABLE IF NOT EXISTS "JournalLine" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "journalEntryId" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "debit" REAL NOT NULL DEFAULT 0,
        "credit" REAL NOT NULL DEFAULT 0,
        "description" TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId")`,
      `CREATE INDEX IF NOT EXISTS "JournalLine_accountId_idx" ON "JournalLine"("accountId")`,
    ];
    for (const statement of statements) {
      try {
        await basePrisma.$executeRawUnsafe(statement);
      } catch (error) {
        // Column/table/index already there — the steady-state path.
        if (isDuplicateColumnError(error)) continue;
        throw error;
      }
    }
  })().catch((error) => {
    moneySchemaRepair = null;
    throw error;
  });

  return moneySchemaRepair;
}

export const prisma = basePrisma.$extends({
  query: {
    payment: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!isMissingPaymentKindError(error)) throw error;
          await ensurePaymentKindColumn();
          return query(args);
        }
      },
    },
    lead: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!isMissingLeadLostReasonError(error)) throw error;
          await ensureLeadLostReasonColumn();
          return query(args);
        }
      },
    },
    client: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!isMissingClientAddressError(error)) throw error;
          await ensureClientAddressColumn();
          return query(args);
        }
      },
    },
    quotation: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!isMissingQuotationTaxError(error)) throw error;
          await ensureQuotationTaxColumns();
          return query(args);
        }
      },
    },
  },
}) as unknown as PrismaClient;

// Eagerly start the engine connection so it's ready before the first request.
// Without this, Prisma 6's lazy initializer races against incoming requests
// (especially better-auth session checks) and throws "Engine is not yet connected".
void basePrisma.$connect().catch(() => {/* errors will surface on first query */});
