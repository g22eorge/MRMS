import { NextResponse } from "next/server";

import { assertPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * What database the running process is actually talking to.
 *
 * Previously reported Turso vs local-SQLite mode and warned when DATABASE_URL
 * was a `file:` URL — the questions that mattered when a deploy could silently
 * fall back to a local file. With one Postgres connection string the useful
 * questions are different: which host and database, as which user, on what
 * server version.
 *
 * The connection string is parsed rather than printed: it contains a password.
 */

function describeConnection(raw: string | undefined) {
  if (!raw) return { configured: false as const };
  try {
    const url = new URL(raw);
    return {
      configured: true as const,
      protocol: url.protocol.replace(":", ""),
      host: url.hostname,
      port: url.port || "5432",
      database: url.pathname.replace(/^\//, "") || null,
      user: url.username || null,
      hasPassword: Boolean(url.password),
      // Pooling and SSL are the two settings most likely to be wrong in a new
      // deployment, so surface them explicitly.
      sslmode: url.searchParams.get("sslmode"),
      connectionLimit: url.searchParams.get("connection_limit"),
      schema: url.searchParams.get("schema") ?? "public",
    };
  } catch {
    return { configured: true as const, malformed: true as const };
  }
}

export async function GET() {
  const user = await assertPlatformAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const connection = describeConnection(process.env.DATABASE_URL);
  const warnings: string[] = [];
  if (!connection.configured) warnings.push("DATABASE_URL is not set.");
  if ("malformed" in connection) warnings.push("DATABASE_URL is not a parseable URL.");
  if (connection.configured && !("malformed" in connection)) {
    if (!connection.hasPassword) warnings.push("DATABASE_URL carries no password.");
    if (process.env.NODE_ENV === "production" && !connection.sslmode) {
      warnings.push("No sslmode in DATABASE_URL; set it explicitly when the database is not on a private network.");
    }
  }

  let server: { version: string | null; database: string | null; user: string | null } = {
    version: null, database: null, user: null,
  };
  let reachable = false;
  try {
    const rows = await prisma.$queryRaw<Array<{ version: string; db: string; usr: string }>>`
      SELECT version() AS version, current_database() AS db, current_user AS usr
    `;
    server = { version: rows[0]?.version ?? null, database: rows[0]?.db ?? null, user: rows[0]?.usr ?? null };
    reachable = true;
  } catch {
    warnings.push("Could not query the database.");
  }

  return NextResponse.json({ ok: reachable, connection, server, warnings });
}
