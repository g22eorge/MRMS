"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";

const editSchema = z.object({
  id: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  serialOrImei: z.string().optional(),
  issueDescription: z.string().min(5),
  technicianNotes: z.string().optional(),
  returnTo: z.string().optional(),
});

export async function updateJobEditAction(formData: FormData) {
  const { user: currentUser, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: currentUser.role, userAccessMode: currentUser.accessMode, kind: "GENERAL" });
  if (currentUser.role === "TECHNICIAN_EXTERNAL" || currentUser.role === "FRONT_DESK") {
    return { error: "Forbidden" };
  }

  const parsed = editSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    model: String(formData.get("model") ?? ""),
    serialOrImei: String(formData.get("serialOrImei") ?? ""),
    issueDescription: String(formData.get("issueDescription") ?? ""),
    technicianNotes: String(formData.get("technicianNotes") ?? ""),
    returnTo: String(formData.get("returnTo") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form values" };
  }

  // Tenant scope: only ever load/write a job in the caller's own org.
  const existing = await prisma.job.findFirst({ where: { id: parsed.data.id, orgId } });
  if (!existing) {
    return { error: "Job not found" };
  }

  if (currentUser.role === "TECHNICIAN_INTERNAL" && existing.assignedToId !== currentUser.id) {
    return { error: "Forbidden" };
  }

  await prisma.job.updateMany({
    where: { id: parsed.data.id, orgId },
    data: {
      brand: sanitizeText(parsed.data.brand),
      model: sanitizeText(parsed.data.model),
      serialOrImei: sanitizeOptionalText(parsed.data.serialOrImei),
      issueDescription: sanitizeText(parsed.data.issueDescription),
      technicianNotes: sanitizeOptionalText(parsed.data.technicianNotes),
    },
  });

  await prisma.auditLog.create({
    data: {
      orgId,
      jobId: parsed.data.id,
      userId: currentUser.id,
      action: "JOB_EDITED",
      detail: JSON.stringify({
        brand: parsed.data.brand,
        model: parsed.data.model,
        serialOrImei: parsed.data.serialOrImei,
      }),
    },
  });

  revalidatePath(`/jobs/${parsed.data.id}`);
  revalidatePath("/jobs");

  const safeReturnTo =
    parsed.data.returnTo &&
    parsed.data.returnTo.startsWith("/") &&
    !parsed.data.returnTo.startsWith("//")
      ? parsed.data.returnTo
      : `/jobs/${parsed.data.id}`;

  return { success: true, redirectTo: safeReturnTo };
}
