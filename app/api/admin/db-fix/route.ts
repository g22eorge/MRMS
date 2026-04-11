import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  // Provide a safe in-browser runner (uses current session cookies).
  // Actual mutation stays on POST.
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DB Fix</title>
  </head>
  <body style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px;">
    <h1 style="margin: 0 0 8px;">MRMS DB Fix</h1>
    <p style="margin: 0 0 16px;">Runs a one-time schema repair (delivery columns + notification tables). Admin only.</p>
    <button id="run" style="padding: 10px 14px; border: 1px solid #000; background: #000; color: #fff; border-radius: 8px; cursor: pointer;">Run Fix</button>
    <pre id="out" style="margin-top: 16px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa; white-space: pre-wrap;"></pre>
    <script>
      const out = document.getElementById('out');
      const btn = document.getElementById('run');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        out.textContent = 'Running...';
        try {
          const res = await fetch(location.href, { method: 'POST', credentials: 'include' });
          const text = await res.text();
          out.textContent = text;
        } catch (e) {
          out.textContent = String(e);
        } finally {
          btn.disabled = false;
        }
      });
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

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
