import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

export type ActiveAnnouncement = { id: string; title: string; body: string; level: string };

/** Cache tag for platform announcements — revalidate on any announcement change. */
export const ANNOUNCEMENTS_TAG = "announcements";

// Platform announcements are global and change rarely, but this runs on every
// authenticated navigation. Cache with a short TTL + tag revalidation; the 60s
// window also bounds how long a just-started/ended announcement can be stale.
const loadActiveAnnouncements = unstable_cache(
  async (): Promise<ActiveAnnouncement[]> => {
    const now = new Date();
    try {
      return await prisma.systemAnnouncement.findMany({
        where: {
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, body: true, level: true },
      });
    } catch {
      // Table may not exist yet in an un-migrated environment — fail soft.
      return [];
    }
  },
  ["active-announcements"],
  { tags: [ANNOUNCEMENTS_TAG], revalidate: 60 },
);

/** Active, in-window platform announcements shown to org users. Safe if the table is missing. */
export async function getActiveAnnouncements(_now: Date = new Date()): Promise<ActiveAnnouncement[]> {
  return loadActiveAnnouncements();
}
