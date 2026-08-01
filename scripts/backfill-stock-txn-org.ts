/** M6 backfill: populate PartStockTransaction.orgId from the owning Part. Idempotent. */
import { prisma } from "@/lib/prisma";
async function main() {
  const rows = await prisma.partStockTransaction.findMany({ where: { orgId: null }, select: { id: true, partId: true } });
  const partOrg = new Map<string, string | null>();
  let updated = 0;
  for (const r of rows) {
    if (!partOrg.has(r.partId)) {
      const p = await prisma.part.findUnique({ where: { id: r.partId }, select: { orgId: true } });
      partOrg.set(r.partId, p?.orgId ?? null);
    }
    const orgId = partOrg.get(r.partId);
    if (orgId) { await prisma.partStockTransaction.update({ where: { id: r.id }, data: { orgId } }); updated++; }
  }
  console.log(`Backfilled orgId on ${updated}/${rows.length} stock-txn rows`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
