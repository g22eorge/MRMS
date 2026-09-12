import { prisma } from "@/lib/prisma";

/**
 * Platform-wide operator settings (payment credentials, plan prices, SMS
 * config, audit retention).
 *
 * Previously this module owned its own table via `CREATE TABLE IF NOT EXISTS`
 * on every call. `PlatformSetting` is now a real model, so reads and writes go
 * through Prisma and the table is created by migrations like everything else.
 * The reads stay fault-tolerant — a settings lookup must never take down a page
 * — but they no longer swallow a missing table as a normal condition.
 */

export async function getPlatformSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setPlatformSetting(key: string, value: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function deletePlatformSetting(key: string): Promise<void> {
  await prisma.platformSetting.deleteMany({ where: { key } });
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
  if (keys.length === 0) return {};
  try {
    // One query instead of the previous loop of one query per key.
    const rows = await prisma.platformSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
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
