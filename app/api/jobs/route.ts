import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export async function GET() {
  const { session, user } = await getCurrentUserRole();

  const where =
    user.role === "TECHNICIAN_EXTERNAL"
      ? { assignedToId: session.user.id }
      : user.role === "TECHNICIAN_INTERNAL"
        ? { assignedToId: session.user.id }
        : {};

  const jobs =
    user.role === "TECHNICIAN_EXTERNAL"
      ? await prisma.job.findMany({
          where,
          select: {
            id: true,
            jobNumber: true,
            status: true,
            repairPath: true,
            deviceType: true,
            brand: true,
            model: true,
            serialOrImei: true,
            accessories: true,
            externalDiagnosis: true,
            partsNeeded: true,
            repairTimeline: true,
            timelineMinMinutes: true,
            timelineMaxMinutes: true,
            timelineConfidence: true,
            timelineNote: true,
            assignedToId: true,
            assignedTo: { select: { id: true, name: true } },
            updatedAt: true,
            receivedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        })
      : await prisma.job.findMany({
          where,
          include: { client: true },
          orderBy: { updatedAt: "desc" },
        });

  return NextResponse.json(jobs);
}
