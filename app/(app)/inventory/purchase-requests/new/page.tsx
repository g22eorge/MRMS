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

  const [suppliers, parts, openRequestCount, urgentRequestCount] = await Promise.all([
    prisma.supplier.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.part.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, unitCost: true } }),
    prisma.purchaseRequest.count({ where: { orgId, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } }).catch(() => 0),
    prisma.purchaseRequest.count({ where: { orgId, priority: "URGENT", status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } }).catch(() => 0),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Inventory · Purchase Request"
        title="New Purchase Request"
        description="Capture the buying case before it becomes a purchase order."
        actions={
          <>
            <Button href="/inventory/purchase-requests" variant="secondary" size="sm">Register</Button>
            <Button href="/inventory/suppliers" variant="secondary" size="sm">Suppliers</Button>
          </>
        }
        kpis={[
          {
            key: "open",
            label: "Open requests",
            value: openRequestCount,
            sub: `${urgentRequestCount} urgent`,
            tone: urgentRequestCount > 0 ? "warn" : "neutral",
            muted: openRequestCount === 0,
          },
          { key: "suppliers", label: "Suppliers", value: suppliers.length, sub: "active vendors", muted: suppliers.length === 0 },
          { key: "catalog", label: "Catalog items", value: parts.length, sub: "available to request", muted: parts.length === 0 },
          { key: "flow", label: "Workflow", value: "PR → PO", sub: "approve before ordering", tone: "good" },
        ]}
      />

      <NewPurchaseRequestForm suppliers={suppliers} parts={parts} />
    </div>
  );
}
