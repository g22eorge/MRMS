import { NextResponse } from "next/server";

import { getCurrentUserRole } from "@/lib/session";
import { retryDueWhatsApp } from "@/lib/notifications/whatsapp-outbox";

export const dynamic = "force-dynamic";

export async function POST() {
  const { user } = await getCurrentUserRole();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await retryDueWhatsApp(25);
  return NextResponse.json(result);
}
