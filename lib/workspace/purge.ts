import { prisma } from "@/lib/prisma";
import { EIS_ORG_ID } from "@/lib/org";

/**
 * Remove an organisation and everything it owns.
 *
 * Only for a workspace whose own administrator asked for deletion: it must be
 * switched off and carry a deletion request, and it can never be the
 * operator's own organisation. Rows go table by table, retrying while one
 * table waits on another (a supplier cannot go before its purchase orders),
 * and the whole thing is one transaction: it removes everything or nothing.
 *
 * Audit tables are left to the database's own rules, so the record that this
 * happened survives the organisation.
 */
export async function purgeOrganisation(orgId: string): Promise<{ removed: number }> {
  if (orgId === EIS_ORG_ID) throw new Error("The operator's own organisation cannot be deleted.");
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { isActive: true, deletionRequestedAt: true },
  });
  if (!org) throw new Error("Organisation not found.");
  if (org.isActive || !org.deletionRequestedAt) {
    throw new Error("Only a deactivated workspace with a deletion request can be deleted.");
  }

  return prisma.$transaction(async (tx) => {
    const tables = await tx.$queryRaw<Array<{ table_name: string }>>`
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE c.table_schema = 'public' AND c.column_name = 'orgId' AND t.table_type = 'BASE TABLE'
        AND c.table_name NOT IN ('SystemAuditEvent', 'AuditLog', 'UserAccessAudit')
    `;
    let removed = 0;
    let pending = tables.map((t) => t.table_name);
    for (let pass = 0; pass < 8 && pending.length > 0; pass += 1) {
      const blocked: string[] = [];
      for (const table of pending) {
        // A savepoint per table: a refused delete must not abort the transaction.
        await tx.$executeRawUnsafe("SAVEPOINT purge_step");
        try {
          removed += await tx.$executeRawUnsafe(`DELETE FROM "${table.replace(/"/g, '""')}" WHERE "orgId" = $1`, orgId);
          await tx.$executeRawUnsafe("RELEASE SAVEPOINT purge_step");
        } catch {
          await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT purge_step");
          blocked.push(table);
        }
      }
      if (blocked.length === pending.length) {
        throw new Error(`Some records are still referenced elsewhere (${blocked.slice(0, 4).join(", ")}). Nothing was deleted.`);
      }
      pending = blocked;
    }
    if (pending.length > 0) throw new Error("Some records could not be removed. Nothing was deleted.");
    await tx.organization.delete({ where: { id: orgId } });
    return { removed };
  }, { timeout: 60_000 });
}
