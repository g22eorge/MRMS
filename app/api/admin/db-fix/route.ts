import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export const dynamic = "force-dynamic";

async function tableExists(name: string) {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${name}
  `;
  return rows.length > 0;
}

async function jobColumns() {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    PRAGMA table_info('Job')
  `;
  return new Set(rows.map((r) => r.name));
}

export async function POST() {
  const { user } = await getCurrentUserRole();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const changes: Array<{ kind: string; detail: string }> = [];

  // Delivery columns
  const cols = await jobColumns();
  if (!cols.has("deliveredAt")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Job" ADD COLUMN "deliveredAt" DATETIME');
    changes.push({ kind: "alter_table", detail: "Added Job.deliveredAt" });
  }
  if (!cols.has("deliveryMethod")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Job" ADD COLUMN "deliveryMethod" TEXT');
    changes.push({ kind: "alter_table", detail: "Added Job.deliveryMethod" });
  }
  if (!cols.has("deliveredTo")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Job" ADD COLUMN "deliveredTo" TEXT');
    changes.push({ kind: "alter_table", detail: "Added Job.deliveredTo" });
  }

  // Notifications
  const hasNotification = await tableExists("Notification");
  if (!hasNotification) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "jobId" TEXT,
        "userId" TEXT,
        "channel" TEXT NOT NULL DEFAULT 'DASHBOARD',
        "isRead" INTEGER NOT NULL DEFAULT 0,
        "readAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Notification_jobId_idx" ON "Notification"("jobId")');
    changes.push({ kind: "create_table", detail: "Created Notification + indexes" });
  }

  const hasPrefs = await tableExists("NotificationPreferences");
  if (!hasPrefs) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NotificationPreferences" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL UNIQUE,
        "notifyStatusChange" INTEGER NOT NULL DEFAULT 1,
        "notifyApprovalNeeded" INTEGER NOT NULL DEFAULT 1,
        "notifyJobAssigned" INTEGER NOT NULL DEFAULT 1,
        "notifyEstimateSubmitted" INTEGER NOT NULL DEFAULT 1,
        "notifyPaymentReceived" INTEGER NOT NULL DEFAULT 1,
        "notifyPayoutGenerated" INTEGER NOT NULL DEFAULT 1,
        "notifyTimelineUpdated" INTEGER NOT NULL DEFAULT 1,
        "notifyDelayNote" INTEGER NOT NULL DEFAULT 1,
        "whatsappEnabled" INTEGER NOT NULL DEFAULT 1,
        "emailEnabled" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    changes.push({ kind: "create_table", detail: "Created NotificationPreferences" });
  }

  // Re-check and report
  const finalCols = await jobColumns();
  return NextResponse.json({
    ok: true,
    applied: changes,
    jobColumnsNow: ["deliveredAt", "deliveryMethod", "deliveredTo"].map((c) => ({ c, present: finalCols.has(c) })),
    tablesNow: {
      Notification: await tableExists("Notification"),
      NotificationPreferences: await tableExists("NotificationPreferences"),
    },
  });
}
