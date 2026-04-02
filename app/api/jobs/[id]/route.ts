import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { session, user } = await getCurrentUserRole();

  const job = await prisma.job.findFirst({
    where:
      user.role === "TECHNICIAN_EXTERNAL"
        ? { id, assignedToId: session.user.id }
        : user.role === "TECHNICIAN_INTERNAL"
          ? { id, assignedToId: session.user.id }
          : { id },
    include: user.role === "TECHNICIAN_EXTERNAL" ? undefined : { client: true, photos: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}
