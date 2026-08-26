"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { findRecentDuplicate } from "@/lib/dedup";
import { sanitizeText } from "@/lib/sanitize";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";

/**
 * Warranty claims against a completed repair.
 *
 * The table and its relations existed with no way to reach them. This is the
 * workflow: a customer brings a device back, someone raises a claim against the
 * original job, and it is later resolved or rejected with a note. The repair
 * done under warranty is an ordinary job, linked to the claim so the history
 * reads back in both directions.
 *
 * Coverage is recorded on the job (warrantyMonths / warrantyExpiresAt) and is
 * NOT enforced here. Whether to honour a lapsed warranty is a commercial
 * decision, not a database rule — so an expired claim is allowed and the state
 * is shown plainly to whoever is deciding.
 */

type Result = { success: true; message: string } | { success: false; error: string };

const openSchema = z.object({
  jobId: z.string().min(1),
  reason: z.string().trim().min(3, "Say what the customer is claiming for."),
});

const resolveSchema = z.object({
  jobId: z.string().min(1),
  claimId: z.string().min(1),
  status: z.enum(["RESOLVED", "REJECTED"]),
  resolution: z.string().trim().min(3, "Say how the claim was settled."),
});

const linkSchema = z.object({
  jobId: z.string().min(1),
  claimId: z.string().min(1),
  warrantyJobId: z.string().min(1),
});

/** Raising a claim is front-desk work; settling one is a manager's call. */
const canRaise = (u: { role: string; permissions?: string[] | null }) =>
  can.createJob({ role: u.role, permissions: u.permissions } as never)
  || can.approveWork({ role: u.role, permissions: u.permissions } as never);

const canSettle = (u: { role: string; permissions?: string[] | null }) =>
  can.approveWork({ role: u.role, permissions: u.permissions } as never);

export async function openWarrantyClaimAction(formData: FormData): Promise<Result> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!canRaise(user)) return { success: false, error: "Not authorised to raise warranty claims." };

  const parsed = openSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid claim." };
  const { jobId } = parsed.data;
  const reason = sanitizeText(parsed.data.reason);

  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: { id: true, jobNumber: true },
  });
  if (!job) return { success: false, error: "Job not found." };

  // One claim per fault, not one per click.
  const dup = await findRecentDuplicate(
    prisma.warrantyClaim,
    { orgId, originalJobId: jobId, reason },
    { createdAtField: "openedAt", windowMs: 60_000 },
  ).catch(() => null);
  if (dup) {
    revalidatePath(`/jobs/${jobId}`);
    return { success: true, message: "That claim is already open." };
  }

  // A second OPEN claim for the same job is nearly always a mistake; the first
  // one should be settled before another is raised against the same repair.
  const alreadyOpen = await prisma.warrantyClaim.findFirst({
    where: { orgId, originalJobId: jobId, status: "OPEN" },
    select: { id: true },
  });
  if (alreadyOpen) {
    return { success: false, error: "This job already has an open claim. Settle it before raising another." };
  }

  await prisma.warrantyClaim.create({
    data: { orgId, originalJobId: jobId, reason, status: "OPEN" },
  });

  revalidatePath(`/jobs/${jobId}`);
  return { success: true, message: `Warranty claim opened against ${job.jobNumber}.` };
}

export async function resolveWarrantyClaimAction(formData: FormData): Promise<Result> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!canSettle(user)) return { success: false, error: "Not authorised to settle warranty claims." };

  const parsed = resolveSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid resolution." };
  const { jobId, claimId, status } = parsed.data;
  const resolution = sanitizeText(parsed.data.resolution);

  // Scope through orgId, which the claim carries in its own right.
  const claim = await prisma.warrantyClaim.findFirst({
    where: { id: claimId, orgId },
    select: { id: true, status: true },
  });
  if (!claim) return { success: false, error: "Claim not found." };
  if (claim.status !== "OPEN") {
    return { success: false, error: `That claim is already ${claim.status.toLowerCase()}.` };
  }

  await prisma.warrantyClaim.update({
    where: { id: claimId },
    data: { status, resolution, closedAt: new Date() },
  });

  revalidatePath(`/jobs/${jobId}`);
  return {
    success: true,
    message: status === "RESOLVED" ? "Claim resolved." : "Claim rejected.",
  };
}

export async function linkWarrantyRepairAction(formData: FormData): Promise<Result> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!canSettle(user)) return { success: false, error: "Not authorised to settle warranty claims." };

  const parsed = linkSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: "Invalid warranty repair." };
  const { jobId, claimId, warrantyJobId } = parsed.data;

  if (warrantyJobId === jobId) {
    return { success: false, error: "The warranty repair has to be a different job from the original." };
  }

  const [claim, repair] = await Promise.all([
    prisma.warrantyClaim.findFirst({ where: { id: claimId, orgId }, select: { id: true } }),
    prisma.job.findFirst({ where: { id: warrantyJobId, orgId }, select: { id: true, jobNumber: true } }),
  ]);
  if (!claim) return { success: false, error: "Claim not found." };
  if (!repair) return { success: false, error: "That repair is not in your workspace." };

  await prisma.warrantyClaim.update({
    where: { id: claimId },
    data: { warrantyJobId },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${warrantyJobId}`);
  return { success: true, message: `Linked ${repair.jobNumber} as the warranty repair.` };
}
