import { prisma } from "@/lib/prisma";

/**
 * Schema introspection, for the few places that legitimately need it: the admin
 * database-health screens.
 *
 * Everything here used to be `sqlite_master` and `PRAGMA table_info` scattered
 * across seven files. Those queries existed because the deployed schema and the
 * datamodel had drifted, so application code had to ask the database what
 * actually existed before touching it. Migrations remove that need — a guard of
 * the form "does this column exist before I read it" is now always true, and the
 * remaining honest use is reporting on the database, not defending against it.
 */

/** Tables in the current schema. */
export async function listTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((r) => r.table_name);
}

export async function tableExists(name: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ one: number }>>`
      SELECT 1 AS one
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ${name}
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export type ColumnInfo = {
  name: string;
  dataType: string;
  nullable: boolean;
  default: string | null;
};

/** Columns of one table, in ordinal order. Empty when the table is absent. */
export async function tableColumns(table: string): Promise<ColumnInfo[]> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>
    >`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ${table}
      ORDER BY ordinal_position
    `;
    return rows.map((r) => ({
      name: r.column_name,
      dataType: r.data_type,
      nullable: r.is_nullable === "YES",
      default: r.column_default,
    }));
  } catch {
    return [];
  }
}

export async function columnNames(table: string): Promise<Set<string>> {
  return new Set((await tableColumns(table)).map((c) => c.name));
}

export async function columnExists(table: string, column: string): Promise<boolean> {
  return (await columnNames(table)).has(column);
}

/** Migrations applied to this database, newest first. */
export async function appliedMigrations(): Promise<
  Array<{ name: string; appliedAt: Date | null; rolledBackAt: Date | null }>
> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
    `;
    return rows.map((r) => ({
      name: r.migration_name,
      appliedAt: r.finished_at,
      rolledBackAt: r.rolled_back_at,
    }));
  } catch {
    return [];
  }
}
