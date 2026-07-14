import { NextResponse } from "next/server";

import {
  buildCommandPaletteQuickActions,
  filterCommandPaletteActions,
} from "@/lib/command-palette/quick-actions";
import { searchCommandPalette } from "@/lib/command-palette/search";
import { requireOrgSession } from "@/lib/org-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, orgId, session } = await requireOrgSession();
  const permissionUser = { role: user.role, permissions: user.permissions };

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  const allActions = buildCommandPaletteQuickActions(permissionUser);
  const actions = filterCommandPaletteActions(allActions, q);
  const results =
    q.length >= 2
      ? await searchCommandPalette({
          orgId,
          userId: session.user.id,
          user: permissionUser,
          q,
        })
      : [];

  return NextResponse.json({ actions, results });
}
