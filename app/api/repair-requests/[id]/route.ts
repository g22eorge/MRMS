import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { can } from "@/lib/permissions";

const ALLOWED_STATUSES = ["APPROVED", "REJECTED", "CONVERTED_TO_JOB"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getCurrentUserRole();
  if (!can.viewClientInfo(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body as { status: string };

  if (!ALLOWED_STATUSES.includes(status as AllowedStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await prisma.repairRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const updated = await prisma.repairRequest.update({
    where: { id },
    data: { requestStatus: status as AllowedStatus },
  });

  return NextResponse.json({ success: true, requestStatus: updated.requestStatus });
}
