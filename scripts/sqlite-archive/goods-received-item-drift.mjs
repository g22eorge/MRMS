/**
 * Rebuilds GoodsReceivedItem where it is still on the pre-Prisma shape.
 *
 * Two production databases drifted apart. care matches schema.prisma; the
 * commercial database was never migrated off an older shape and instead had the
 * new columns added *beside* the old ones:
 *
 *   legacy: id, grnId, partId NOT NULL, orderedQty NOT NULL, receivedQty NOT NULL,
 *           unitCost, note, createdAt, poItemId, description, quantity
 *   prisma: id, grnId, poItemId, partId, description, quantity, unitCost, createdAt
 *
 * Prisma writes `quantity` and has never heard of `receivedQty`, so every
 * goods-receipt insert died on `NOT NULL constraint failed:
 * GoodsReceivedItem.receivedQty`. Receiving stock was impossible for every
 * tenant on that deployment — seven purchase orders were raised and not one
 * receipt ever completed.
 *
 * Why a dedicated script: sync-schema-to-db.mjs adds missing tables and columns
 * but never rebuilds an existing table, and SQLite cannot drop a NOT NULL
 * constraint any other way. The same reasoning as
 * scripts/warranty-claim-foreign-keys.mjs.
 *
 * Unlike that script this one MIGRATES rather than refuses when it finds rows:
 * the legacy shape was a working shape once, so real receipts may exist behind
 * it, and `receivedQty` is exactly the quantity the new column wants. Dropping
 * those would be destroying stock history to fix a constraint.
 *
 * Idempotent: once the table is on the target shape it exits without touching
 * anything, so it is safe to run on every deploy.
 *
 *   node scripts/goods-received-item-drift.mjs
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("[grn-drift] TURSO_DATABASE_URL is not set — nothing to do.");
  process.exit(0);
}

const client = createClient({ url, authToken });

/** The target shape, character for character what care already has. */
const CREATE_SQL = (table) => `
CREATE TABLE "${table}" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "grnId" TEXT NOT NULL,
  "poItemId" TEXT,
  "partId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceivedItem_grnId_fkey" FOREIGN KEY ("grnId")
    REFERENCES "GoodsReceived" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GoodsReceivedItem_partId_fkey" FOREIGN KEY ("partId")
    REFERENCES "Part" ("id") ON DELETE SET NULL ON UPDATE CASCADE
)`;

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "GoodsReceivedItem_grnId_idx" ON "GoodsReceivedItem"("grnId")`,
  `CREATE INDEX IF NOT EXISTS "GoodsReceivedItem_partId_idx" ON "GoodsReceivedItem"("partId")`,
  `CREATE INDEX IF NOT EXISTS "GoodsReceivedItem_poItemId_idx" ON "GoodsReceivedItem"("poItemId")`,
];

const TMP = "__GoodsReceivedItem_rebuild";

async function columns(table) {
  const r = await client.execute(`PRAGMA table_info('${table}')`);
  return r.rows.map((c) => ({ name: String(c.name), notNull: Number(c.notnull) === 1 }));
}

async function main() {
  const exists = await client.execute(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='GoodsReceivedItem'`,
  );
  if (exists.rows.length === 0) {
    console.log("[grn-drift] Table absent — sync-schema-to-db will create it correctly.");
    return;
  }

  const cols = await columns("GoodsReceivedItem");
  const has = (n) => cols.some((c) => c.name === n);
  const notNull = (n) => cols.some((c) => c.name === n && c.notNull);

  // The drift signature: any legacy column still present, or a column whose
  // nullability disagrees with the model. Checking columns rather than parsing
  // the DDL string keeps this honest if the table was patched by hand.
  const legacy = ["receivedQty", "orderedQty", "note"].filter(has);
  const wrongNullability = notNull("partId") || !notNull("quantity") || !notNull("description");

  if (legacy.length === 0 && !wrongNullability && has("quantity") && has("description")) {
    console.log("[grn-drift] Table already matches schema.prisma — nothing to do.");
    return;
  }

  console.log(
    `[grn-drift] Drift found — legacy columns: ${legacy.join(", ") || "(none)"};` +
      ` nullability wrong: ${wrongNullability}.`,
  );

  const count = await client.execute(`SELECT COUNT(*) AS n FROM "GoodsReceivedItem"`);
  const rows = Number(count.rows[0].n ?? 0);
  console.log(`[grn-drift] Migrating ${rows} row(s).`);

  // Legacy rows carry the quantity in receivedQty and may have no description;
  // coalesce so a real receipt survives the move with its numbers intact rather
  // than being dropped or zeroed. The part name is the best description a
  // legacy row can offer, and '' only when even that is missing.
  const qty = has("quantity") ? `COALESCE("quantity", ${has("receivedQty") ? `"receivedQty",` : ""} 0)`
                              : has("receivedQty") ? `COALESCE("receivedQty", 0)` : `0`;
  const desc = has("description")
    ? `COALESCE(NULLIF("description", ''), (SELECT "name" FROM "Part" WHERE "Part"."id" = "GoodsReceivedItem"."partId"), '')`
    : `COALESCE((SELECT "name" FROM "Part" WHERE "Part"."id" = "GoodsReceivedItem"."partId"), '')`;
  const poItem = has("poItemId") ? `"poItemId"` : `NULL`;

  await client.execute(`DROP TABLE IF EXISTS "${TMP}"`);
  await client.execute(CREATE_SQL(TMP));
  await client.execute(`
    INSERT INTO "${TMP}" ("id", "grnId", "poItemId", "partId", "description", "quantity", "unitCost", "createdAt")
    SELECT "id", "grnId", ${poItem}, "partId", ${desc}, ${qty}, COALESCE("unitCost", 0), "createdAt"
    FROM "GoodsReceivedItem"
  `);

  const moved = await client.execute(`SELECT COUNT(*) AS n FROM "${TMP}"`);
  if (Number(moved.rows[0].n ?? 0) !== rows) {
    console.error(
      `[grn-drift] REFUSING to swap: copied ${moved.rows[0].n} of ${rows} rows. Original left untouched.`,
    );
    await client.execute(`DROP TABLE IF EXISTS "${TMP}"`);
    process.exit(1);
  }

  // Dropping the table takes its indexes with it, so the names are free again.
  await client.execute(`DROP TABLE "GoodsReceivedItem"`);
  await client.execute(`ALTER TABLE "${TMP}" RENAME TO "GoodsReceivedItem"`);
  for (const sql of INDEXES) await client.execute(sql);

  const after = await columns("GoodsReceivedItem");
  const stillLegacy = ["receivedQty", "orderedQty", "note"].filter((n) =>
    after.some((c) => c.name === n),
  );
  const finalCount = await client.execute(`SELECT COUNT(*) AS n FROM "GoodsReceivedItem"`);
  const ok = stillLegacy.length === 0 && Number(finalCount.rows[0].n ?? 0) === rows;

  console.log(
    ok
      ? `[grn-drift] Done — table rebuilt on the Prisma shape with ${rows} row(s) preserved.`
      : `[grn-drift] WARNING: rebuild finished but table still looks wrong (${stillLegacy.join(", ")}).`,
  );
  if (!ok) process.exit(1);
}

main()
  .catch((error) => {
    console.error("[grn-drift] Failed:", error?.message ?? error);
    process.exit(1);
  })
  .finally(() => client.close?.());
