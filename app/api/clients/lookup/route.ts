import { NextRequest, NextResponse } from "next/server";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { icontains } from "@/lib/db/search";

export async function GET(req: NextRequest) {
  const { user, orgId } = await requireOrgSession();
  if (!can.viewClientInfo(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ clients: [] });
  }

  try {
    const clients = await prisma.client.findMany({
      where: {
        orgId,
        OR: [
          { fullName: icontains(q) },
          { phone: icontains(q) },
          { email: icontains(q) },
          { organization: icontains(q) },
          { address: icontains(q) },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, fullName: true, phone: true, email: true, organization: true, address: true },
    });

    return NextResponse.json({ clients });
  } catch (err) {
    console.error("[clients/lookup] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
