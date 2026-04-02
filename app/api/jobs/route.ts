import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export async function GET() {
  const { session, user } = await getCurrentUserRole();

  const jobs = await prisma.job.findMany({
    where:
      user.role === "TECHNICIAN_EXTERNAL"
        ? { assignedToId: session.user.id }
        : user.role === "TECHNICIAN_INTERNAL"
          ? { assignedToId: session.user.id }
          : {},
    include: user.role === "TECHNICIAN_EXTERNAL" ? undefined : { client: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(jobs);
}
