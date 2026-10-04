import { PrismaClient } from "@prisma/client";

/**
 * Removes an e2e fixture organisation and everything scoped to it.
 *
 * The specs seed with `upsert` keyed on a stable org slug, so re-seeding is
 * idempotent — but the rows the tests then *create* (jobs, quotations,
 * invoices, receipts, stock movements) are not, and nothing removed them. Five
 * specs created data and exactly one cleaned up, so every run left more behind:
 * the local database reached 108 leftover jobs against 33 real ones, and the
 * accumulation changed what the later visual specs saw, which is why the same
 * code produced different failures run to run.
 *
 * Deleting by orgId rather than by name means a spec cannot miss a table it
 * forgot it wrote to: every org-scoped table is swept, discovered from the
 * schema rather than listed here, so a new model is covered without anyone
 * remembering to add it.
 *
 * Postgres version. The SQLite one guarded on a `file:` URL, discovered tables
 * through sqlite_master and PRAGMA table_info, suspended foreign keys with
 * PRAGMA, and bound `?` — none of which Postgres has, and the guard alone made
 * every call throw, so all nine specs that clean up after themselves failed
 * before reaching anything they test.
 */

const SAFE_SLUG = /^e2e[-_]/i;

/**
 * The SQLite guard's point was "never a database that matters", and it got
 * that from the URL scheme: a `file:` database was a local one. Every database
 * is a server now, so the database name has to carry it. The e2e suite runs
 * against `mrms_scratch` (playwright.config.ts). The development database is
 * `mrms`, and it holds imported production data — this refuses it exactly as
 * it refuses production.
 */
const SAFE_DATABASE = /(scratch|test|e2e)/i;

function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

export async function destroyE2eOrg(prisma: PrismaClient, slug: string): Promise<void> {
  if (!SAFE_SLUG.test(slug)) {
    throw new Error(`destroyE2eOrg refuses "${slug}": fixture slugs must start with e2e- or e2e_.`);
  }
  const db = databaseName(process.env.DATABASE_URL ?? "");
  if (!SAFE_DATABASE.test(db)) {
    throw new Error(
      `destroyE2eOrg refuses database "${db || "(unparseable DATABASE_URL)"}": ` +
        "it deletes an organisation outright, so it runs only against a scratch, test or e2e database.",
    );
  }

  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  if (!org) return;

  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT c.table_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' AND c.column_name = 'orgId' AND c.table_name <> 'Organization'`,
  );

  // One transaction, because the foreign-key suspension below is per session
  // and a pooled client would otherwise run each statement on whichever
  // connection is free — the suspension on one, the deletes on another.
  await prisma.$transaction(
    async (tx) => {
      // Postgres for PRAGMA foreign_keys=OFF: replica mode skips the FK
      // triggers. SET LOCAL ends with the transaction, so nothing leaks onto a
      // pooled connection. Needs a superuser, which the scratch container's
      // POSTGRES_USER is.
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);

      // Auth rows hang off userId, not orgId, so they go before the users do.
      await tx.$executeRawUnsafe(
        `DELETE FROM "Session" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "orgId" = $1)`, org.id,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "Account" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "orgId" = $1)`, org.id,
      );

      for (const { table_name } of tables) {
        await tx.$executeRawUnsafe(`DELETE FROM "${table_name}" WHERE "orgId" = $1`, org.id);
      }

      // LeadActivity carries no orgId (it hangs off Lead), so the sweep above
      // never touches it — and with FKs suspended its rows survive the lead and
      // user deletes. A stale row whose user is gone makes the lead query throw
      // ("Field user is required ..., got null"), which the page masks as NOT
      // FOUND. Sweep orphans explicitly.
      await tx.$executeRawUnsafe(
        `DELETE FROM "LeadActivity"
          WHERE "leadId" NOT IN (SELECT "id" FROM "Lead") OR "userId" NOT IN (SELECT "id" FROM "User")`,
      );

      await tx.$executeRawUnsafe(`DELETE FROM "Organization" WHERE "id" = $1`, org.id);
    },
    { timeout: 60_000 },
  );
}
