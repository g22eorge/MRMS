"use server";

import { JobStatus, RepairPath, Role } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hasJobPayoutColumns } from "@/lib/payouts";
import { sanitizeOptionalText } from "@/lib/sanitize";
import { getCurrentUserRole } from "@/lib/session";

const updateSchema = z.object({
  jobId: z.string().min(1),
  assignedToId: z.string().optional(),
  diagnosisNotes: z.string().optional(),
  externalDiagnosis: z.string().optional(),
  partsNeeded: z.string().optional(),
  externalTechBill: z.coerce.number().optional(),
  clientBill: z.coerce.number().optional(),
  externalTechFee: z.coerce.number().optional(),
  externalPaid: z.enum(["true", "false"]).optional(),
  externalPaymentRef: z.string().optional(),
  repairPath: z.nativeEnum(RepairPath).optional(),
  repairTimeline: z.string().optional(),
  timelineMinValue: z.coerce.number().positive().optional(),
  timelineMaxValue: z.coerce.number().positive().optional(),
  timelineUnit: z.enum(["HOUR", "DAY", "WEEK"]).optional(),
  timelineConfidence: z.enum(["FIRM", "ESTIMATED", "PARTS_DEPENDENT"]).optional(),
  timelineNote: z.string().optional(),
  workDone: z.string().optional(),
  partsReplaced: z.string().optional(),
  nextStatus: z.nativeEnum(JobStatus).optional(),
});

function buildTimeline(payload: z.infer<typeof updateSchema>) {
  const unitMinutes =
    payload.timelineUnit === "HOUR"
      ? 60
      : payload.timelineUnit === "DAY"
        ? 60 * 24
        : payload.timelineUnit === "WEEK"
          ? 60 * 24 * 7
          : null;

  if (!unitMinutes || (!payload.timelineMinValue && !payload.timelineMaxValue)) {
    return null;
  }

  const minValue = payload.timelineMinValue ?? payload.timelineMaxValue ?? 0;
  const maxValue = payload.timelineMaxValue ?? payload.timelineMinValue ?? 0;
  const minMinutes = Math.round(minValue * unitMinutes);
  const maxMinutes = Math.round(maxValue * unitMinutes);
  const unitLabel = payload.timelineUnit ?? "HOUR";
  const labelUnit = unitLabel.toLowerCase() + (maxValue > 1 || minValue > 1 ? "s" : "");
  const label = minValue === maxValue ? `${minValue} ${labelUnit}` : `${minValue}-${maxValue} ${labelUnit}`;

  return {
    timelineMinMinutes: Math.min(minMinutes, maxMinutes),
    timelineMaxMinutes: Math.max(minMinutes, maxMinutes),
    repairTimeline: label,
  };
}

export async function updateJobAction(formData: FormData) {
  const { session, user } = await getCurrentUserRole();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const payload = parsed.data;
  const existing = await prisma.job.findUnique({ where: { id: payload.jobId } });
  if (!existing) {
    return { error: "Job not found" };
  }

  const transitions: Partial<Record<JobStatus, JobStatus[]>> = {
    RECEIVED: [JobStatus.DIAGNOSING],
    DIAGNOSING: [JobStatus.IN_REPAIR, JobStatus.REFERRED],
    REFERRED: [JobStatus.AWAITING_APPROVAL],
    AWAITING_APPROVAL: [JobStatus.IN_REPAIR, JobStatus.CLOSED],
    IN_REPAIR: [JobStatus.COMPLETED],
  };

  if (payload.nextStatus) {
    const allowedForStatus = transitions[existing.status] ?? [];
    if (!allowedForStatus.includes(payload.nextStatus)) {
      return { error: "Invalid status transition" };
    }
  }

  const roleCanTransition = (role: Role, nextStatus: JobStatus) => {
    if (role === "ADMIN") return true;
    if (role === "TECHNICIAN_INTERNAL") {
      return ([JobStatus.DIAGNOSING, JobStatus.IN_REPAIR, JobStatus.COMPLETED] as JobStatus[]).includes(nextStatus);
    }
    if (role === "TECHNICIAN_EXTERNAL") {
      return ([JobStatus.COMPLETED] as JobStatus[]).includes(nextStatus);
    }
    if (role === "OPS") {
      return ([JobStatus.AWAITING_APPROVAL, JobStatus.CLOSED, JobStatus.IN_REPAIR] as JobStatus[]).includes(nextStatus);
    }
    return false;
  };

  if (payload.nextStatus && !roleCanTransition(user.role, payload.nextStatus)) {
    return { error: "You do not have permission for this status change" };
  }

  if (payload.nextStatus === JobStatus.COMPLETED) {
    const incomingClientBill = typeof payload.clientBill === "number" ? payload.clientBill : undefined;
    const existingClientBill =
      typeof (existing as { clientBill?: number | null }).clientBill === "number"
        ? (existing as { clientBill?: number }).clientBill
        : typeof (existing as { finalCost?: number | null }).finalCost === "number"
          ? (existing as { finalCost?: number }).finalCost
          : undefined;
    const hasFinalCostAfterUpdate =
      typeof existingClientBill === "number" || typeof incomingClientBill === "number";

    if (!hasFinalCostAfterUpdate) {
      return {
        error:
          "Cannot complete job yet. Our bill to client must be set by Accounts/Admin first.",
      };
    }
  }

  if (
    (user.role === "TECHNICIAN_EXTERNAL" || user.role === "TECHNICIAN_INTERNAL") &&
    existing.assignedToId !== session.user.id
  ) {
    return { error: "Forbidden" };
  }

  const payoutChangeRequested =
    payload.externalTechFee !== undefined ||
    payload.externalPaid !== undefined ||
    payload.externalPaymentRef !== undefined;

  if (payoutChangeRequested && (user.role === "ADMIN" || user.role === "ACCOUNTS")) {
    const payoutColumnsReady = await hasJobPayoutColumns();
    if (!payoutColumnsReady) {
      return {
        error:
          "Payout fields are not available in this environment yet. Run latest Prisma migration and restart the app.",
      };
    }
  }

  const data: Record<string, unknown> = {};
  const timeline = buildTimeline(payload);

  if (user.role === "TECHNICIAN_EXTERNAL") {
    data.externalDiagnosis = sanitizeOptionalText(payload.externalDiagnosis) || undefined;
    data.partsNeeded = sanitizeOptionalText(payload.partsNeeded) || undefined;
    data.repairTimeline = timeline?.repairTimeline ?? (sanitizeOptionalText(payload.repairTimeline) || undefined);
    data.timelineMinMinutes = timeline?.timelineMinMinutes;
    data.timelineMaxMinutes = timeline?.timelineMaxMinutes;
    data.timelineConfidence = payload.timelineConfidence;
    data.timelineNote = sanitizeOptionalText(payload.timelineNote) || undefined;
    data.externalTechBill = payload.externalTechBill;
    if (payload.nextStatus === JobStatus.COMPLETED) {
      data.status = JobStatus.COMPLETED;
      data.completedAt = new Date();
    }
  } else {
    data.diagnosisNotes = sanitizeOptionalText(payload.diagnosisNotes) || undefined;
    data.externalDiagnosis = sanitizeOptionalText(payload.externalDiagnosis) || undefined;
    data.partsNeeded = sanitizeOptionalText(payload.partsNeeded) || undefined;
    data.repairTimeline = timeline?.repairTimeline ?? (sanitizeOptionalText(payload.repairTimeline) || undefined);
    data.timelineMinMinutes = timeline?.timelineMinMinutes;
    data.timelineMaxMinutes = timeline?.timelineMaxMinutes;
    data.timelineConfidence = payload.timelineConfidence;
    data.timelineNote = sanitizeOptionalText(payload.timelineNote) || undefined;
    data.workDone = sanitizeOptionalText(payload.workDone) || undefined;
    data.partsReplaced = sanitizeOptionalText(payload.partsReplaced) || undefined;
    data.externalTechBill = payload.externalTechBill;
    data.repairPath = payload.repairPath;
    if ((user.role === "ADMIN" || user.role === "OPS") && payload.assignedToId !== undefined) {
      const assigneeId = payload.assignedToId.trim();
      if (!assigneeId) {
        data.assignedToId = null;
      } else {
        const assignee = await prisma.user.findFirst({
          where: {
            id: assigneeId,
            isActive: true,
            role: { in: [Role.TECHNICIAN_INTERNAL, Role.TECHNICIAN_EXTERNAL] },
          },
          select: { id: true },
        });

        if (!assignee) {
          return { error: "Invalid assignee. Select an active technician." };
        }

        data.assignedToId = assignee.id;
      }
    }
    if (user.role === "ADMIN" || user.role === "ACCOUNTS") {
      data.clientBill = payload.clientBill;
      data.externalTechFee = payload.externalTechFee;

      if (payload.externalPaymentRef !== undefined) {
        data.externalPaymentRef = sanitizeOptionalText(payload.externalPaymentRef) || null;
      }

      if (payload.externalPaid !== undefined) {
        const isPaid = payload.externalPaid === "true";
        data.externalPaid = isPaid;
        data.externalPaidAt = isPaid ? new Date() : null;
        data.externalPaidById = isPaid ? session.user.id : null;
        if (!isPaid) {
          data.externalPaymentRef = null;
        }
      }
    }
    data.status = payload.nextStatus;
    if (existing.status === JobStatus.AWAITING_APPROVAL && payload.nextStatus) {
      data.clientApproved = payload.nextStatus === JobStatus.IN_REPAIR;
      data.approvalDate = new Date();
    }
    data.completedAt = payload.nextStatus === JobStatus.COMPLETED ? new Date() : undefined;
    data.closedAt = payload.nextStatus === JobStatus.CLOSED ? new Date() : undefined;
  }

  let updated;
  try {
    updated = await prisma.job.update({
      where: { id: payload.jobId },
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("Unknown argument `timelineMinMinutes`") ||
      message.includes("Unknown argument `timelineMaxMinutes`") ||
      message.includes("Unknown argument `timelineConfidence`") ||
      message.includes("Unknown argument `timelineNote`") ||
      message.includes("Unknown argument `clientBill`") ||
      message.includes("Unknown argument `externalTechBill`")
    ) {
      const fallbackData = { ...data } as Record<string, unknown>;
      delete fallbackData.timelineMinMinutes;
      delete fallbackData.timelineMaxMinutes;
      delete fallbackData.timelineConfidence;
      delete fallbackData.timelineNote;

      if ("clientBill" in fallbackData) {
        fallbackData.finalCost = fallbackData.clientBill;
        delete fallbackData.clientBill;
      }
      if ("externalTechBill" in fallbackData) {
        fallbackData.costEstimate = fallbackData.externalTechBill;
        delete fallbackData.externalTechBill;
      }

      updated = await (prisma.job as unknown as {
        update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{
          id: string;
        }>;
      }).update({
        where: { id: payload.jobId },
        data: fallbackData,
      });
    } else {
      throw error;
    }
  }

  await prisma.auditLog.create({
    data: {
      jobId: updated.id,
      userId: session.user.id,
      action: payload.nextStatus ? "STATUS_CHANGED" : "JOB_UPDATED",
      detail: JSON.stringify(payload),
    },
  });

  return { success: true };
}
