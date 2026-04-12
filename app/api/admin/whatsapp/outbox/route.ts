import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getCurrentUserRole();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.outboundMessage.findMany({
    where: { channel: "WHATSAPP" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      status: true,
      to: true,
      attemptCount: true,
      lastAttemptAt: true,
      nextAttemptAt: true,
      sentAt: true,
      provider: true,
      providerMessageId: true,
      lastErrorCode: true,
      lastError: true,
      repairRequestId: true,
      jobId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, rows });
}
