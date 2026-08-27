import { PrismaClient } from "@prisma/client";

/**
 * Removes an e2e fixture organisation and everything scoped to it.
 *
 * The specs seed with `upsert` keyed on a stable org slug, so re-seeding is
 * idempotent — but the rows the tests then *create* (jobs, quotations,
 * invoices, receipts, stock movements) are not, and nothing removed them. Five
 * specs created data and exactly one cleaned up, so every run left more behind:
 * the local database reached 108 leftover jobs against 33 real ones, and the
 * accumulation changed what the later visual specs saw, which is why the same
 * code produced different failures run to run.
 *
 * Deleting by orgId rather than by name means a spec cannot miss a table it
 * forgot it wrote to: every org-scoped table is swept, discovered from the
 * schema rather than listed here, so a new model is covered without anyone
 * remembering to add it.
 */

const SAFE_SLUG = /^e2e[-_]/i;

export async function destroyE2eOrg(prisma: PrismaClient, slug: string): Promise<void> {
  // Two guards, because this deletes an organisation outright. The slug rule
  // keeps it to fixtures, and the file: rule keeps it off Turso — a stray run
  // against production would otherwise remove a real tenant.
  if (!SAFE_SLUG.test(slug)) {
    throw new Error(`destroyE2eOrg refuses "${slug}": fixture slugs must start with e2e- or e2e_.`);
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) {
    throw new Error("destroyE2eOrg refuses to run against a non-file database.");
  }

  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  if (!org) return;

  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'`,
  );

  // Order-independent: the sweep below does not know the dependency graph, and
  // does not need to with the constraint suspended for the duration.
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys=OFF");
  try {
    // Auth rows hang off userId, not orgId, so they go before the users do.
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Session" WHERE userId IN (SELECT id FROM "User" WHERE orgId = ?)`, org.id,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Account" WHERE userId IN (SELECT id FROM "User" WHERE orgId = ?)`, org.id,
    );

    for (const { name } of tables) {
      if (name === "Organization") continue;
      const cols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info('${name}')`);
      if (!cols.some((c) => c.name === "orgId")) continue;
      await prisma.$executeRawUnsafe(`DELETE FROM "${name}" WHERE orgId = ?`, org.id);
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "Organization" WHERE id = ?`, org.id);
  } finally {
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys=ON");
  }
}
