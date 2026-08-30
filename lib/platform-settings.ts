import { prisma } from "@/lib/prisma";

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PlatformSetting" (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableEnsured = true;
}

export async function getPlatformSetting(key: string): Promise<string | null> {
  try {
    await ensureTable();
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT value FROM "PlatformSetting" WHERE key = ${key} LIMIT 1
    `;
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setPlatformSetting(key: string, value: string): Promise<void> {
  await ensureTable();
  await prisma.$executeRaw`
    INSERT INTO "PlatformSetting" (key, value, updatedAt)
    VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
  `;
}

export async function deletePlatformSetting(key: string): Promise<void> {
  await ensureTable();
  await prisma.$executeRaw`DELETE FROM "PlatformSetting" WHERE key = ${key}`;
}

/**
 * Is the settings store readable, and which keys does it hold?
 *
 * getPlatformSetting catches every read error and returns null, so a missing
 * value and an unreadable table are indistinguishable to every caller. That is
 * usually the right trade — a settings lookup should not take a page down — but
 * it makes "no Pesapal credentials configured" ambiguous exactly when someone
 * is trying to find out why payments do not work.
 *
 * Returns key NAMES only, never values: the names answer the question and the
 * values are secrets.
 *
 * Deliberately does not call ensureTable(), so this stays a pure read. If the
 * table does not exist, saying so is the answer rather than a reason to create
 * it.
 */
export async function probePlatformSettingStore(): Promise<{
  readable: boolean;
  keys: string[];
  error: string | null;
}> {
  try {
    const rows = await prisma.$queryRaw<Array<{ key: string }>>`
      SELECT key FROM "PlatformSetting" ORDER BY key
    `;
    return { readable: true, keys: rows.map((r) => r.key), error: null };
  } catch (err) {
    return {
      readable: false,
      keys: [],
      error: err instanceof Error ? err.message.slice(0, 200) : "PlatformSetting could not be read",
    };
  }
}

export async function getPlatformSettings(keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  try {
    await ensureTable();
    for (const key of keys) {
      const rows = await prisma.$queryRaw<Array<{ value: string }>>`
        SELECT value FROM "PlatformSetting" WHERE key = ${key} LIMIT 1
      `;
      if (rows[0]) result[key] = rows[0].value;
    }
  } catch {
    // return partial result
  }
  return result;
}

// ── Pesapal ──────────────────────────────────────────────────────────────────

/**
 * Africa's Talking credentials, from the database first.
 *
 * These were saved by the platform settings form into PlatformSetting and then
 * read by nobody: getAtConfig consulted the per-org config row and
 * process.env, never the database. So an administrator could enter a key,
 * watch the page show it as configured — the page reads the same table the form
 * wrote to — and send no SMS at all, with nothing anywhere saying why. Exactly
 * the shape of the Pesapal defect, in the integration next to it.
 *
 * Same precedence as the Pesapal helpers below: stored value, then environment.
 */
export async function getAtApiKey(): Promise<string | null> {
  const db = await getPlatformSetting("AT_API_KEY");
  return db ?? process.env.AT_API_KEY ?? null;
}

export async function getAtUsername(): Promise<string | null> {
  const db = await getPlatformSetting("AT_USERNAME");
  return db ?? process.env.AT_USERNAME ?? null;
}

export async function getAtSenderId(): Promise<string | null> {
  const db = await getPlatformSetting("AT_SENDER_ID");
  return db ?? process.env.AT_SENDER_ID ?? null;
}

export async function getPesapalConsumerKey(): Promise<string | null> {
  const db = await getPlatformSetting("PESAPAL_CONSUMER_KEY");
  return db ?? process.env.PESAPAL_CONSUMER_KEY ?? null;
}

export async function getPesapalConsumerSecret(): Promise<string | null> {
  const db = await getPlatformSetting("PESAPAL_CONSUMER_SECRET");
  return db ?? process.env.PESAPAL_CONSUMER_SECRET ?? null;
}
