"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

const LEVELS = ["INFO", "WARNING", "CRITICAL"];

export async function createAnnouncementAction(formData: FormData) {
  const admin = await requirePlatformAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "INFO").trim().toUpperCase();
  const level = LEVELS.includes(levelRaw) ? levelRaw : "INFO";
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  if (!title || !body) return;

  const created = await prisma.systemAnnouncement.create({
    data: {
      title,
      body,
      level,
      startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
      endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
      createdById: admin.id,
    },
    select: { id: true },
  });

  await writeSystemAuditEvent({
    actorUserId: admin.id,
    entityType: "SystemAnnouncement",
    entityId: created.id,
    action: "ANNOUNCEMENT_PUBLISHED",
    summary: `${level}: ${title}`,
  });

  revalidatePath("/platform/announcements");
}

export async function toggleAnnouncementAction(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";
  if (!id) return;
  await prisma.systemAnnouncement.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/platform/announcements");
}

export async function deleteAnnouncementAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.systemAnnouncement.delete({ where: { id } });
  await writeSystemAuditEvent({
    actorUserId: admin.id,
    entityType: "SystemAnnouncement",
    entityId: id,
    action: "ANNOUNCEMENT_DELETED",
    summary: `Announcement ${id} deleted`,
  });
  revalidatePath("/platform/announcements");
}
