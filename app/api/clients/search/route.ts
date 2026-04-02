import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export async function GET(req: NextRequest) {
  await getCurrentUserRole();
  const phone = req.nextUrl.searchParams.get("phone")?.trim();

  if (!phone || phone.length < 3) {
    return NextResponse.json({ client: null });
  }

  const client = await prisma.client.findUnique({
    where: { phone },
    select: { id: true, fullName: true, phone: true, email: true, organization: true },
  });

  return NextResponse.json({ client });
}
