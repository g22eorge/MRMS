"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { generateAssessmentDraft } from "@/lib/ai/assessment";

async function requireStaff() {
  const ctx = await requireOrgSession();
  assertOrgCanMutate({ access: ctx.org.access, userRole: ctx.user.role, userAccessMode: ctx.user.accessMode, kind: "GENERAL" });
  return ctx;
}

/** Create an assessment report for the job — AI-drafted when available, else blank. Stays INTERNAL until published. */
export async function generateAssessmentAction(formData: FormData): Promise<void> {
  const { user, orgId } = await requireStaff();
  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) return;

  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      jobNumber: true, status: true, brand: true, model: true, deviceType: true, issueDescription: true,
      diagnosisNotes: true, externalDiagnosis: true, recommendedRepair: true, workDone: true,
      partsNeeded: true, technicianNotes: true,
    },
  });
  if (!job) return;

  // Require diagnosis + repair details before drafting (parts optional). Each
  // can come from more than one field depending on the workflow.
  const diagnosis = (job.diagnosisNotes ?? "").trim() || (job.externalDiagnosis ?? "").trim();
  const repairDetails = (job.recommendedRepair ?? "").trim() || (job.workDone ?? "").trim();
  if (!diagnosis || !repairDetails) {
    // The draft is generated from what is already on the job, so an empty
    // diagnosis means the button quietly did nothing at all.
    redirect(`/jobs/${jobId}?error=${encodeURIComponent("Record the diagnosis and the recommended repair on this job before drafting an assessment.")}`);
  }

  const ai = await generateAssessmentDraft({
    orgId,
    userId: user.id,
    // Status drives the tense: a report drafted before the work is written in
    // the future, one drafted after it in the past.
    job: { ...job, status: String(job.status), deviceType: String(job.deviceType), diagnosisNotes: diagnosis, recommendedRepair: repairDetails },
  });

  const draft = ai.ok
    ? ai.draft
    : { summary: "", findings: "", recommendedWork: "", riskNotes: "" };

  await prisma.diagnosisReport.create({
    data: {
      orgId,
      jobId,
      authorId: user.id,
      visibility: "INTERNAL",
      summary: draft.summary || `Assessment for ${job.jobNumber}`,
      findings: draft.findings || null,
      recommendedWork: draft.recommendedWork || null,
      riskNotes: draft.riskNotes || null,
    },
  });

  await writeSystemAuditEvent({
    orgId, actorUserId: user.id, entityType: "DiagnosisReport", entityId: jobId,
    action: "ASSESSMENT_DRAFTED", summary: ai.ok ? "AI-drafted assessment created" : "Blank assessment created (AI unavailable)",
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateAssessmentAction(formData: FormData): Promise<void> {
  const { orgId } = await requireStaff();
  const id = String(formData.get("reportId") ?? "").trim();
  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!id) return;
  const report = await prisma.diagnosisReport.findFirst({ where: { id, orgId }, select: { id: true } });
  if (!report) return;

  await prisma.diagnosisReport.update({
    where: { id },
    data: {
      summary: String(formData.get("summary") ?? "").trim() || "Assessment",
      findings: String(formData.get("findings") ?? "").trim() || null,
      recommendedWork: String(formData.get("recommendedWork") ?? "").trim() || null,
      riskNotes: String(formData.get("riskNotes") ?? "").trim() || null,
    },
  });
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

/** Toggle a report between INTERNAL (staff-only) and CLIENT (customer-visible in the portal). */
export async function publishAssessmentAction(formData: FormData): Promise<void> {
  const { user, orgId } = await requireStaff();
  const id = String(formData.get("reportId") ?? "").trim();
  const jobId = String(formData.get("jobId") ?? "").trim();
  const makeVisible = String(formData.get("visible") ?? "") === "true";
  if (!id) return;
  const report = await prisma.diagnosisReport.findFirst({ where: { id, orgId }, select: { id: true } });
  if (!report) return;

  await prisma.diagnosisReport.update({ where: { id }, data: { visibility: makeVisible ? "CLIENT" : "INTERNAL" } });
  await writeSystemAuditEvent({
    orgId, actorUserId: user.id, entityType: "DiagnosisReport", entityId: id,
    action: makeVisible ? "ASSESSMENT_PUBLISHED" : "ASSESSMENT_UNPUBLISHED",
    summary: makeVisible ? "Assessment made visible to the client" : "Assessment hidden from the client",
  });
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

export async function deleteAssessmentAction(formData: FormData): Promise<void> {
  const { orgId } = await requireStaff();
  const id = String(formData.get("reportId") ?? "").trim();
  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!id) return;
  await prisma.diagnosisReport.deleteMany({ where: { id, orgId } });
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

/** Set the warranty coverage on the completed repair (shown in the portal). */
export async function setWarrantyAction(formData: FormData): Promise<void> {
  const { user, orgId } = await requireStaff();
  const jobId = String(formData.get("jobId") ?? "").trim();
  const months = Math.max(0, Math.floor(Number(String(formData.get("months") ?? "0"))));
  if (!jobId) return;

  const job = await prisma.job.findFirst({ where: { id: jobId, orgId }, select: { completedAt: true } });
  if (!job) return;

  if (months <= 0) {
    await prisma.job.updateMany({ where: { id: jobId, orgId }, data: { warrantyMonths: null, warrantyExpiresAt: null } });
  } else {
    const from = job.completedAt ?? new Date();
    const expires = new Date(from);
    expires.setMonth(expires.getMonth() + months);
    await prisma.job.updateMany({ where: { id: jobId, orgId }, data: { warrantyMonths: months, warrantyExpiresAt: expires } });
  }
  await writeSystemAuditEvent({
    orgId, actorUserId: user.id, entityType: "Job", entityId: jobId,
    action: "WARRANTY_SET", summary: months > 0 ? `Warranty set to ${months} months` : "Warranty cleared",
  });
  revalidatePath(`/jobs/${jobId}`);
}
