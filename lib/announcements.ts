import { prisma } from "@/lib/prisma";

export type ActiveAnnouncement = { id: string; title: string; body: string; level: string };

/** Active, in-window platform announcements shown to org users. Safe if the table is missing. */
export async function getActiveAnnouncements(now: Date = new Date()): Promise<ActiveAnnouncement[]> {
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
}
