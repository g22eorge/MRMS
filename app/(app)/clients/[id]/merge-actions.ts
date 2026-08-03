"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

/**
 * Every table that carries a `clientId` foreign key. A merge reassigns each of
 * these from the source client to the target BEFORE the source is deleted, so
 * nothing is orphaned — and, critically, so the source owns no rows when it is
 * removed (several of these relations cascade on client delete, which would
 * otherwise destroy live jobs/invoices).
 *
 * Keep this list in sync with the schema: `grep -n "clientId " prisma/schema.prisma`.
 */
const CLIENT_CHILD_MODELS = [
  "device", "clientNote", "job", "invoice", "sale", "inboundMessage", "repairRequest",
  "customerConsent", "recurringInvoice", "receipt", "conversation", "lead", "quotation",
  "campaignContact", "portalUser", "repairMessage",
] as const;

type Delegate = {
  count: (args: { where: { clientId: string } }) => Promise<number>;
  updateMany: (args: { where: { clientId: string }; data: { clientId: string } }) => Promise<{ count: number }>;
};

function delegate(client: unknown, model: string): Delegate {
  return (client as Record<string, Delegate>)[model];
}

function isMissingTable(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return m.includes("no such table") || m.includes("does not exist") || m.includes("no such column");
}

export type ClientMergePreview = {
  ok: boolean;
  error?: string;
  source?: { id: string; fullName: string; phone: string; organization: string | null };
  target?: { id: string; fullName: string; phone: string; organization: string | null };
  counts?: Record<string, number>;
  totalMoving?: number;
};

/** Read-only: what would move if `sourceId` were merged into `targetId`. */
export async function previewClientMerge(sourceId: string, targetId: string): Promise<ClientMergePreview> {
  const { user, orgId } = await requireOrgSession();
  if (user.role !== "ADMIN") return { ok: false, error: "Only an administrator can merge clients." };
  if (!sourceId || !targetId) return { ok: false, error: "Select a client to merge into." };
  if (sourceId === targetId) return { ok: false, error: "Pick a different target client." };

  const sel = { id: true, fullName: true, phone: true, organization: true } as const;
  const [source, target] = await Promise.all([
    prisma.client.findFirst({ where: { id: sourceId, orgId }, select: sel }),
    prisma.client.findFirst({ where: { id: targetId, orgId }, select: sel }),
  ]);
  if (!source) return { ok: false, error: "Source client not found in this organisation." };
  if (!target) return { ok: false, error: "Target client not found in this organisation." };

  const counts: Record<string, number> = {};
  let totalMoving = 0;
  for (const model of CLIENT_CHILD_MODELS) {
    try {
      const n = await delegate(prisma, model).count({ where: { clientId: sourceId } });
      if (n > 0) counts[model] = n;
      totalMoving += n;
    } catch (e) {
      if (!isMissingTable(e)) throw e; // a table this prod DB lacks simply has nothing to move
    }
  }
  return { ok: true, source, target, counts, totalMoving };
}

/**
 * Merge `sourceId` INTO `targetId`: reassign every linked record, then delete the
 * now-empty source. Atomic. ADMIN-only. Org-scoped on both ends.
 */
export async function mergeClientIntoAction(input: {
  sourceId: string;
  targetId: string;
}): Promise<{ success: boolean; error?: string; moved?: number }> {
  const { user, orgId, org } = await requireOrgSession();
  if (user.role !== "ADMIN") return { success: false, error: "Only an administrator can merge clients." };
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const sourceId = input.sourceId?.trim();
  const targetId = input.targetId?.trim();
  if (!sourceId || !targetId) return { success: false, error: "Both a source and a target client are required." };
  if (sourceId === targetId) return { success: false, error: "Pick a different target client to merge into." };

  const [source, target] = await Promise.all([
    prisma.client.findFirst({ where: { id: sourceId, orgId }, select: { id: true, fullName: true, phone: true } }),
    prisma.client.findFirst({ where: { id: targetId, orgId }, select: { id: true, fullName: true } }),
  ]);
  if (!source) return { success: false, error: "Source client not found in this organisation." };
  if (!target) return { success: false, error: "Target client not found in this organisation." };

  // Pre-flight OUTSIDE the transaction: determine which child tables actually
  // exist in this database. Doing it here (not inside the txn) avoids poisoning
  // the transaction on a lagging prod schema.
  const presentModels: string[] = [];
  for (const model of CLIENT_CHILD_MODELS) {
    try {
      await delegate(prisma, model).count({ where: { clientId: sourceId } });
      presentModels.push(model);
    } catch (e) {
      if (!isMissingTable(e)) throw e;
    }
  }

  let moved = 0;
  try {
    await prisma.$transaction(async (tx) => {
      for (const model of presentModels) {
        const res = await delegate(tx, model).updateMany({
          where: { clientId: sourceId },
          data: { clientId: targetId },
        });
        moved += res.count;
      }
      // Source now owns nothing; safe to remove.
      await tx.client.delete({ where: { id: sourceId } });
    });
  } catch (e) {
    return { success: false, error: `Merge failed (nothing was changed): ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}` };
  }

  await writeSystemAuditEvent({
    orgId,
    actorUserId: user.id,
    entityType: "Client",
    entityId: targetId,
    action: "CLIENT_MERGED",
    summary: `Merged client "${source.fullName}" (${source.phone}) into "${target.fullName}" — moved ${moved} linked records`,
  }).catch(() => {});

  revalidatePath("/clients");
  revalidatePath(`/clients/${targetId}`);
  revalidatePath(`/clients/${sourceId}`);
  return { success: true, moved };
}
