"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";

/** Staff replies to a client's portal message on a repair. */
export async function staffReplyRepairMessageAction(formData: FormData): Promise<void> {
  const { user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const jobId = String(formData.get("jobId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!jobId || body.length === 0) return;

  const job = await prisma.job.findFirst({ where: { id: jobId, orgId }, select: { id: true, clientId: true } });
  if (!job) return;

  await prisma.repairMessage.create({
    data: {
      orgId,
      jobId: job.id,
      clientId: job.clientId,
      authorType: "STAFF",
      authorId: user.id,
      authorName: user.name ?? "Support",
      body: body.slice(0, 4000),
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}
