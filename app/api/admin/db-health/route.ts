import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { appliedMigrations, listTables, tableColumns } from "@/lib/db-introspect";
import { assertPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Database health report.
 *
 * The previous version asked `sqlite_master` and `PRAGMA table_info` about a
 * hardcoded list of tables and columns — a list that had to be edited whenever
 * the schema grew, and which only ever covered whatever had last gone wrong in
 * production. This compares the *whole* datamodel against the live schema, so it
 * cannot fall behind, and reports migration state, which is now the actual
 * mechanism that keeps the two in step.
 *
 * Read-only by construction.
 */

type ColumnDrift = { table: string; missingColumns: string[]; unexpectedColumns: string[] };

function expectedSchema() {
  const tables = new Map<string, Set<string>>();
  for (const model of Prisma.dmmf.datamodel.models) {
    const columns = new Set<string>();
    for (const field of model.fields) {
      if (field.kind === "object" || field.isList) continue;
      columns.add(field.dbName ?? field.name);
    }
    tables.set(model.dbName ?? model.name, columns);
  }
  return tables;
}

/**
 * Rows that would prevent a unique index from being created. Read-only: which
 * of a duplicate pair is authoritative is a human decision about money, not
 * something a deploy step should resolve silently.
 */
async function uniqueConstraintRisks() {
  const checks: Array<{ index: string; sql: string }> = [
    {
      index: "Invoice_jobId_key",
      sql: `SELECT COALESCE(SUM(c - 1), 0)::int AS n FROM (SELECT COUNT(*) AS c FROM "Invoice" WHERE "jobId" IS NOT NULL GROUP BY "jobId" HAVING COUNT(*) > 1) d`,
    },
    {
      index: "Receipt_orgId_paymentId_key",
      sql: `SELECT COALESCE(SUM(c - 1), 0)::int AS n FROM (SELECT COUNT(*) AS c FROM "Receipt" GROUP BY "orgId", "paymentId" HAVING COUNT(*) > 1) d`,
    },
    {
      index: "Invoice_invoiceNumber_key",
      sql: `SELECT COALESCE(SUM(c - 1), 0)::int AS n FROM (SELECT COUNT(*) AS c FROM "Invoice" WHERE "invoiceNumber" IS NOT NULL AND TRIM("invoiceNumber") <> '' GROUP BY "invoiceNumber" HAVING COUNT(*) > 1) d`,
    },
    {
      index: "DocumentBrandingSettings_orgId_dupes",
      sql: `SELECT COALESCE(SUM(c - 1), 0)::int AS n FROM (SELECT COUNT(*) AS c FROM "DocumentBrandingSettings" WHERE "orgId" IS NOT NULL GROUP BY "orgId" HAVING COUNT(*) > 1) d`,
    },
  ];

  return Promise.all(
    checks.map(async ({ index, sql }) => {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(sql);
        return { index, violatingRows: Number(rows[0]?.n ?? 0) };
      } catch {
        return { index, violatingRows: null };
      }
    }),
  );
}

export async function GET() {
  const user = await assertPlatformAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const expected = expectedSchema();
  const [liveTables, migrations, risks] = await Promise.all([
    listTables(),
    appliedMigrations(),
    uniqueConstraintRisks(),
  ]);

  const live = new Set(liveTables);
  const missingTables = [...expected.keys()].filter((t) => !live.has(t)).sort();
  const unexpectedTables = liveTables
    .filter((t) => !expected.has(t) && t !== "_prisma_migrations")
    .sort();

  // Column-level drift, only for tables that exist on both sides.
  const columnDrift: ColumnDrift[] = [];
  for (const [table, expectedColumns] of [...expected].sort(([a], [b]) => a.localeCompare(b))) {
    if (!live.has(table)) continue;
    const actual = new Set((await tableColumns(table)).map((c) => c.name));
    const missingColumns = [...expectedColumns].filter((c) => !actual.has(c)).sort();
    const unexpectedColumns = [...actual].filter((c) => !expectedColumns.has(c)).sort();
    if (missingColumns.length || unexpectedColumns.length) {
      columnDrift.push({ table, missingColumns, unexpectedColumns });
    }
  }

  const jobStatusCounts = await prisma.job
    .groupBy({ by: ["status"], _count: { _all: true } })
    .then((rows) =>
      rows
        .map((r) => ({ status: String(r.status), count: r._count._all }))
        .sort((a, b) => b.count - a.count),
    )
    .catch(() => null);

  const serverVersion = await prisma
    .$queryRaw<Array<{ v: string }>>`SELECT version() AS v`
    .then((r) => r[0]?.v ?? null)
    .catch(() => null);

  const inSync =
    missingTables.length === 0 && unexpectedTables.length === 0 && columnDrift.length === 0;

  return NextResponse.json({
    ok: true,
    schema: {
      inSync,
      expectedTables: expected.size,
      liveTables: liveTables.length,
      missingTables,
      unexpectedTables,
      columnDrift,
    },
    migrations: {
      applied: migrations.filter((m) => m.appliedAt && !m.rolledBackAt).length,
      rolledBack: migrations.filter((m) => m.rolledBackAt).length,
      // Newest first; the full list is short because the history was baselined.
      history: migrations.slice(0, 20),
    },
    uniqueConstraintRisks: risks,
    jobStatusCounts,
    runtime: { serverVersion },
  });
}
