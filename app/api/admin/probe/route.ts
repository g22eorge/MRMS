import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export const dynamic = "force-dynamic";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

export async function GET() {
  const { user } = await getCurrentUserRole();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: Record<string, unknown> = {
    ok: true,
    checks: {},
  };

  const run = async <T,>(name: string, fn: () => Promise<T>) => {
    try {
      const value = await fn();
      (results.checks as Record<string, unknown>)[name] = { ok: true, value };
    } catch (e) {
      results.ok = false;
      (results.checks as Record<string, unknown>)[name] = { ok: false, error: serializeError(e) };
    }
  };

  // Baseline connectivity
  await run("db:tables", async () =>
    prisma.$queryRaw<Array<{ name: string }>>`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
  );

  // Core reads used by dashboard/jobs
  await run("job:count", async () => prisma.job.count());
  await run("job:groupByStatus", async () =>
    prisma.job.groupBy({ by: ["status"], _count: { status: true } }),
  );
  await run("job:groupByDeviceType", async () =>
    prisma.job.groupBy({ by: ["deviceType"], _count: { deviceType: true } }),
  );
  await run("job:recent", async () =>
    prisma.job.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: { id: true, jobNumber: true, status: true, updatedAt: true },
    }),
  );

  // Notifications (these were missing in prod)
  await run("notification:count", async () => prisma.notification.count());
  await run("notificationPreferences:count", async () => prisma.notificationPreferences.count());

  // Session user lookup path
  await run("user:current", async () =>
    prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true, isActive: true } }),
  );
  await run("userPermission:sample", async () =>
    prisma.userPermission.findMany({ take: 5, select: { userId: true, permission: true } }),
  );

  return NextResponse.json(results);
}
