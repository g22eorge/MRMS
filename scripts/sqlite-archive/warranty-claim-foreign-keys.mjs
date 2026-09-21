/**
 * Adds the missing foreign keys to WarrantyClaim in a Turso/libSQL database.
 *
 * Why a dedicated script: scripts/sync-schema-to-db.mjs creates missing tables
 * and adds missing columns, but it deliberately skips FOREIGN KEY / CONSTRAINT
 * lines and never rebuilds a table that already exists. WarrantyClaim exists in
 * production without its constraints, so the schema change alone would never
 * reach the database — Prisma would believe in relations the DB does not have.
 *
 * SQLite cannot add a constraint to an existing table; the table has to be
 * rebuilt. That is only safe while the table is empty, which it is in every
 * environment today. This script therefore REFUSES to run if it finds any rows,
 * rather than risk destroying warranty history. If it ever refuses, the fix is
 * a real data migration, not a flag.
 *
 * Idempotent: if the constraints are already present it exits without touching
 * anything, so it is safe to run on every deploy.
 *
 *   node scripts/warranty-claim-foreign-keys.mjs
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("[warranty-fk] TURSO_DATABASE_URL is not set — nothing to do.");
  process.exit(0);
}

const client = createClient({ url, authToken });

const CREATE_SQL = `
CREATE TABLE "WarrantyClaim" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "originalJobId" TEXT NOT NULL,
  "warrantyJobId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "resolution" TEXT,
  "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" DATETIME,
  CONSTRAINT "WarrantyClaim_orgId_fkey" FOREIGN KEY ("orgId")
    REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WarrantyClaim_originalJobId_fkey" FOREIGN KEY ("originalJobId")
    REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WarrantyClaim_warrantyJobId_fkey" FOREIGN KEY ("warrantyJobId")
    REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
)`;

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "WarrantyClaim_orgId_status_openedAt_idx" ON "WarrantyClaim"("orgId", "status", "openedAt")`,
  `CREATE INDEX IF NOT EXISTS "WarrantyClaim_originalJobId_idx" ON "WarrantyClaim"("originalJobId")`,
  `CREATE INDEX IF NOT EXISTS "WarrantyClaim_warrantyJobId_idx" ON "WarrantyClaim"("warrantyJobId")`,
];

async function main() {
  const exists = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='WarrantyClaim'`,
  );
  if (exists.rows.length === 0) {
    console.log("[warranty-fk] Table absent — sync-schema-to-db will create it with constraints.");
    return;
  }

  const ddl = String(exists.rows[0].sql ?? "");
  const current = await client.execute(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='WarrantyClaim'`,
  );
  const definition = String(current.rows[0]?.sql ?? ddl);

  if (/FOREIGN KEY/i.test(definition)) {
    console.log("[warranty-fk] Constraints already present — nothing to do.");
    return;
  }

  const count = await client.execute(`SELECT COUNT(*) AS n FROM "WarrantyClaim"`);
  const rows = Number(count.rows[0].n ?? 0);
  if (rows > 0) {
    console.error(
      `[warranty-fk] REFUSING: WarrantyClaim holds ${rows} row(s). Rebuilding the table ` +
        `would risk that data. Migrate the rows deliberately, then re-run.`,
    );
    process.exit(1);
  }

  console.log("[warranty-fk] Table is empty — rebuilding with foreign keys.");
  // No transaction wrapper: libSQL runs these sequentially, and on an empty
  // table each step is independently safe to retry.
  await client.execute(`DROP TABLE "WarrantyClaim"`);
  await client.execute(CREATE_SQL);
  for (const sql of INDEXES) await client.execute(sql);

  const after = await client.execute(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='WarrantyClaim'`,
  );
  const ok = /FOREIGN KEY/i.test(String(after.rows[0]?.sql ?? ""));
  console.log(ok
    ? "[warranty-fk] Done — WarrantyClaim now has its foreign keys."
    : "[warranty-fk] WARNING: rebuild finished but no constraints found.");
  if (!ok) process.exit(1);
}

main()
  .catch((error) => {
    console.error("[warranty-fk] Failed:", error?.message ?? error);
    process.exit(1);
  })
  .finally(() => client.close?.());
