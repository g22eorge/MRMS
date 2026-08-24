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

export async function getPesapalConsumerKey(): Promise<string | null> {
  const db = await getPlatformSetting("PESAPAL_CONSUMER_KEY");
  return db ?? process.env.PESAPAL_CONSUMER_KEY ?? null;
}

export async function getPesapalConsumerSecret(): Promise<string | null> {
  const db = await getPlatformSetting("PESAPAL_CONSUMER_SECRET");
  return db ?? process.env.PESAPAL_CONSUMER_SECRET ?? null;
}
