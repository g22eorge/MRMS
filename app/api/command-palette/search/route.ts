import { NextRequest, NextResponse } from "next/server";

import { searchCommandPalette } from "@/lib/command-palette/search";
import { requireOrgSession } from "@/lib/org-context";

export async function GET(req: NextRequest) {
  const { user, orgId, session } = await requireOrgSession();
  const query = req.nextUrl.searchParams.get("q") ?? "";

  try {
    const results = await searchCommandPalette({
      orgId,
      userId: session.user.id,
      role: user.role,
      permissions: user.permissions,
      query,
    });
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[command-palette/search] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
