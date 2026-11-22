import { NextResponse } from "next/server";

import { appliedMigrations } from "@/lib/db-introspect";
import { assertPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

/**
 * Retired: this endpoint used to repair the production schema at runtime.
 *
 * It was 2,600 lines and 312 raw SQL calls — `PRAGMA table_info` probes,
 * `ALTER TABLE ... ADD COLUMN` for columns the code had outgrown, SQLite
 * table rebuilds with `PRAGMA foreign_keys=OFF`. It existed because the
 * deployed schema and the datamodel had no other way to converge: there was no
 * migration history in any environment.
 *
 * There is now. Schema changes reach a database exactly one way,
 * `prisma migrate deploy`, run before the app starts. An endpoint that issues
 * ad-hoc DDL against production is precisely the mechanism that produced the
 * drift this migration had to reconcile — 51 columns the datamodel expected and
 * the database lacked, 16 the database had and the datamodel did not, and six
 * whole tables that existed only because code created them on demand.
 *
 * Kept as a reachable endpoint rather than deleted, because several admin
 * screens link here: it should explain itself to whoever follows the link.
 * Read-only. Use /api/admin/db-health for the drift report.
 */

const EXPLANATION = {
  retired: true,
  message:
    "Schema repair is no longer performed at runtime. Migrations are applied by `prisma migrate deploy` when the app is released.",
  whatToDoInstead: [
    "GET /api/admin/db-health — reports table/column drift against the datamodel and lists applied migrations.",
    "Deploy: the release runs `prisma migrate deploy` before the app starts, so a missing column means the migration step failed.",
    "Schema change: edit prisma/schema.prisma, run `bunx prisma migrate dev` locally, commit the generated migration.",
  ],
} as const;

export async function GET() {
  const user = await assertPlatformAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const migrations = await appliedMigrations();
  return NextResponse.json({
    ...EXPLANATION,
    migrations: {
      applied: migrations.filter((m) => m.appliedAt && !m.rolledBackAt).length,
      latest: migrations[0]?.name ?? null,
      // A migration recorded but never finished means `migrate deploy` failed
      // partway; the database is in an unknown state and needs attention.
      unfinished: migrations.filter((m) => !m.appliedAt && !m.rolledBackAt).map((m) => m.name),
    },
  });
}

export async function POST() {
  const user = await assertPlatformAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // 410 rather than 404: the endpoint existed, was removed on purpose, and is
  // not coming back.
  return NextResponse.json(EXPLANATION, { status: 410 });
}
