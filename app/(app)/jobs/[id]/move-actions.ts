// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

/**
 * Move a single job to a different client account. Used to sort jobs that were
 * booked under the wrong company account (e.g. a C-Care job that belongs to IMC
 * but was captured under IHK). Reassigns the job AND the records that carry a
 * redundant client reference of their own — quotations, the invoice, that
 * invoice's receipts, and any linked repair request — so nothing points back at
 * the old account. Job-scoped rows without a client (photos, messages, status
 * history, payments-via-invoice) follow the job automatically.
 */
export async function moveJobToClientAction(input: {
  jobId: string;
  targetClientId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { user, orgId, org } = await requireOrgSession();
  if (!["ADMIN", "OPS"].includes(user.role)) {
    return { success: false, error: "Only an administrator or operations lead can move a job to another account." };
  }
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const jobId = input.jobId?.trim();
  const targetClientId = input.targetClientId?.trim();
  if (!jobId || !targetClientId) return { success: false, error: "A job and a target account are required." };

  const [job, target] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, orgId }, select: { id: true, jobNumber: true, clientId: true } }),
    prisma.client.findFirst({ where: { id: targetClientId, orgId }, select: { id: true, fullName: true } }),
  ]);
  if (!job) return { success: false, error: "Job not found in this organisation." };
  if (!target) return { success: false, error: "Target account not found in this organisation." };
  if (job.clientId === targetClientId) return { success: false, error: "The job is already on that account." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: jobId }, data: { clientId: targetClientId } });
      await tx.quotation.updateMany({ where: { jobId }, data: { clientId: targetClientId } });
      // Invoice.jobId is unique — at most one invoice, plus its receipts.
      const invoice = await tx.invoice.findFirst({ where: { jobId }, select: { id: true } });
      if (invoice) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { clientId: targetClientId } });
        await tx.receipt.updateMany({ where: { invoiceId: invoice.id }, data: { clientId: targetClientId } });
      }
      await tx.repairRequest.updateMany({ where: { linkedJobId: jobId }, data: { clientId: targetClientId } });
    });
  } catch (e) {
    return { success: false, error: `Move failed (nothing changed): ${(e instanceof Error ? e.message : String(e)).slice(0, 180)}` };
  }

  await writeSystemAuditEvent({
    orgId,
    actorUserId: user.id,
    entityType: "Job",
    entityId: jobId,
    action: "JOB_MOVED_CLIENT",
    summary: `Moved job ${job.jobNumber} to account "${target.fullName}"`,
  }).catch(() => {});

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/clients");
  return { success: true };
}
