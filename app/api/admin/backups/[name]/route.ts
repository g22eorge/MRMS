import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { getCurrentUserRole } from "@/lib/session";
import { checkCanRunOpsTools } from "@/lib/platform-admin";
import { isValidBackupName, resolveBackupDir } from "@/lib/backups";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { user } = await getCurrentUserRole().catch(() => ({ user: null }));
  if (!user || !(await checkCanRunOpsTools(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await params;
  // Strict allowlist — traversal impossible: anything but a generated
  // mrms-YYYY-MM-DD_HH-MM-SS.db name is rejected before touching the disk.
  if (!isValidBackupName(name)) {
    return NextResponse.json({ error: "Unknown backup" }, { status: 404 });
  }

  const filePath = path.join(resolveBackupDir(), name);
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("not a file");
    const stream = createReadStream(filePath);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "content-type": "application/x-sqlite3",
        "content-length": String(stat.size),
        "content-disposition": `attachment; filename="${name}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unknown backup" }, { status: 404 });
  }
}
