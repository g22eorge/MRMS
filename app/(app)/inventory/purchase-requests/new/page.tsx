import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewPurchaseRequestForm } from "./NewPurchaseRequestForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseRequestPage() {
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const [suppliers, parts] = await Promise.all([
    prisma.supplier.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.part.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, unitCost: true } }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Inventory · Purchases"
        title="New purchase request"
        description="Ask to buy stock. Approve it, and it turns into a supplier order."
        actions={<Button href="/inventory/purchase-requests" variant="secondary" size="sm">All requests</Button>}
      />

      <NewPurchaseRequestForm suppliers={suppliers} parts={parts} />
    </div>
  );
}
