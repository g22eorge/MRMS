"use server";

import {
  CommunicationStatus,
  JobStatus,
  RecommendationOption,
  RepairPath,
  Role,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hasJobPayoutColumns } from "@/lib/payouts";
import { sanitizeOptionalText } from "@/lib/sanitize";
import { getCurrentUserRole } from "@/lib/session";

const workflowReasonValues = [
  "NONE",
  "PARTS_PENDING",
  "SPECIALIST_ESCALATION",
  "CLIENT_DECLINED",
  "UNREPAIRABLE",
  "CUSTOMER_CANCELLED",
  "OTHER",
] as const;

const updateSchema = z.object({
  jobId: z.string().min(1),
  expectedUpdatedAt: z.string().optional(),
  assignedToId: z.string().optional(),
  diagnosisNotes: z.string().optional(),
  externalDiagnosis: z.string().optional(),
  partsNeeded: z.string().optional(),
  externalTechBill: z.coerce.number().optional(),
  clientBill: z.coerce.number().optional(),
  externalTechFee: z.coerce.number().optional(),
  vatApplicable: z.enum(["true", "false"]).optional(),
  externalPaid: z.enum(["true", "false"]).optional(),
  externalPaymentRef: z.string().optional(),
  recommendationOption: z.nativeEnum(RecommendationOption).optional(),
  communicationStatus: z.nativeEnum(CommunicationStatus).optional(),
  clientConversationNote: z.string().optional(),
  repairPath: z.nativeEnum(RepairPath).optional(),
  repairTimeline: z.string().optional(),
  timelineMinValue: z.coerce.number().positive().optional(),
  timelineMaxValue: z.coerce.number().positive().optional(),
  timelineUnit: z.enum(["HOUR", "DAY", "WEEK"]).optional(),
  timelineConfidence: z.enum(["FIRM", "ESTIMATED", "PARTS_DEPENDENT"]).optional(),
  timelineNote: z.string().optional(),
  workflowReason: z.enum(workflowReasonValues).optional(),
  statusNote: z.string().optional(),
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
  const hasPartsNeededField = formData.has("partsNeeded");
  const hasStatusNoteField = formData.has("statusNote");
  const hasWorkflowReasonField = formData.has("workflowReason");
  const hasCommunicationStatusField = formData.has("communicationStatus");
  const hasClientConversationNoteField = formData.has("clientConversationNote");
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const payload = parsed.data;
  const existing = await prisma.job.findUnique({ where: { id: payload.jobId } });
  if (!existing) {
    return { error: "Job not found" };
  }

  if (payload.expectedUpdatedAt) {
    const expected = new Date(payload.expectedUpdatedAt).toISOString();
    const actual = existing.updatedAt.toISOString();
    if (expected !== actual) {
      return {
        error:
          "This job changed since you opened it. Refresh and review latest updates before saving.",
      };
    }
  }

  const transitions: Partial<Record<JobStatus, JobStatus[]>> = {
    RECEIVED: [JobStatus.DIAGNOSING],
    DIAGNOSING: [JobStatus.IN_REPAIR, JobStatus.AWAITING_APPROVAL, JobStatus.CLOSED],
    AWAITING_APPROVAL: [JobStatus.IN_REPAIR, JobStatus.CLOSED],
    IN_REPAIR: [JobStatus.READY_FOR_PICKUP, JobStatus.COMPLETED, JobStatus.CLOSED],
    READY_FOR_PICKUP: [JobStatus.COMPLETED, JobStatus.CLOSED],
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
      return (
        [
          JobStatus.DIAGNOSING,
          JobStatus.IN_REPAIR,
          JobStatus.READY_FOR_PICKUP,
          JobStatus.COMPLETED,
          JobStatus.CLOSED,
        ] as JobStatus[]
      ).includes(nextStatus);
    }
    if (role === "TECHNICIAN_EXTERNAL") {
      return ([JobStatus.COMPLETED] as JobStatus[]).includes(nextStatus);
    }
    if (role === "OPS") {
      return (
        [
          JobStatus.AWAITING_APPROVAL,
          JobStatus.CLOSED,
          JobStatus.IN_REPAIR,
          JobStatus.READY_FOR_PICKUP,
          JobStatus.COMPLETED,
        ] as JobStatus[]
      ).includes(nextStatus);
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
          "Cannot complete job yet. Our bill to client must be set by Admin first.",
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

  const adminFinancialChangeRequested =
    payload.clientBill !== undefined || payload.vatApplicable !== undefined;

  if (adminFinancialChangeRequested && user.role !== "ADMIN") {
    return { error: "Only admin can update client billing controls." };
  }

  if (payoutChangeRequested && user.role !== "ADMIN") {
    return { error: "Only admin can update payout controls." };
  }

  if (payoutChangeRequested && user.role === "ADMIN") {
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
    if (hasPartsNeededField) {
      data.partsNeeded = sanitizeOptionalText(payload.partsNeeded) || null;
    }
    if (hasStatusNoteField) {
      data.statusNote = sanitizeOptionalText(payload.statusNote) || null;
    }
    if (hasWorkflowReasonField) {
      data.workflowReason = payload.workflowReason ?? "NONE";
    }
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
    if (hasPartsNeededField) {
      data.partsNeeded = sanitizeOptionalText(payload.partsNeeded) || null;
    }
    if (hasStatusNoteField) {
      data.statusNote = sanitizeOptionalText(payload.statusNote) || null;
    }
    if (hasWorkflowReasonField) {
      data.workflowReason = payload.workflowReason ?? "NONE";
    }
    data.repairTimeline = timeline?.repairTimeline ?? (sanitizeOptionalText(payload.repairTimeline) || undefined);
    data.timelineMinMinutes = timeline?.timelineMinMinutes;
    data.timelineMaxMinutes = timeline?.timelineMaxMinutes;
    data.timelineConfidence = payload.timelineConfidence;
    data.timelineNote = sanitizeOptionalText(payload.timelineNote) || undefined;
    data.workDone = sanitizeOptionalText(payload.workDone) || undefined;
    data.partsReplaced = sanitizeOptionalText(payload.partsReplaced) || undefined;
    data.externalTechBill = payload.externalTechBill;
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
          select: { id: true, role: true },
        });

        if (!assignee) {
          return { error: "Invalid assignee. Select an active technician." };
        }

        data.assignedToId = assignee.id;
        data.repairPath =
          assignee.role === Role.TECHNICIAN_EXTERNAL
            ? RepairPath.EXTERNAL
            : RepairPath.IN_HOUSE;
      }
    }
    if (user.role === "ADMIN") {
      data.clientBill = payload.clientBill;
      data.externalTechFee = payload.externalTechFee;
      if (payload.vatApplicable !== undefined) {
        data.vatApplicable = payload.vatApplicable === "true";
      }

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
    if (user.role === "ADMIN" || user.role === "OPS") {
      if (payload.recommendationOption !== undefined) {
        data.recommendationOption = payload.recommendationOption;
      }
      if (hasCommunicationStatusField) {
        data.communicationStatus = payload.communicationStatus ?? existing.communicationStatus;
      }

      const nextClientConversationNote =
        hasClientConversationNoteField
          ? sanitizeOptionalText(payload.clientConversationNote) || null
          : existing.clientConversationNote;

      if (hasClientConversationNoteField) {
        data.clientConversationNote = nextClientConversationNote;
      }

      const communicationChanged =
        hasCommunicationStatusField &&
        (payload.communicationStatus ?? existing.communicationStatus) !== existing.communicationStatus;
      const conversationChanged =
        hasClientConversationNoteField && nextClientConversationNote !== existing.clientConversationNote;

      if (communicationChanged || conversationChanged) {
        data.lastClientContactAt = new Date();
      }
    }
    data.status = payload.nextStatus;
    if (existing.status === JobStatus.AWAITING_APPROVAL && payload.nextStatus) {
      data.clientApproved = payload.nextStatus === JobStatus.IN_REPAIR;
      data.approvalDate = new Date();
    }
    data.completedAt = payload.nextStatus === JobStatus.COMPLETED ? new Date() : undefined;
    data.closedAt =
      payload.nextStatus === JobStatus.CLOSED
        ? new Date()
        : undefined;
  }

  let updated;
  try {
    updated = await prisma.job.update({
      where: { id: payload.jobId },
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const legacyClientBillField = message.includes("Unknown argument `clientBill`");
    const legacyExternalBillField = message.includes("Unknown argument `externalTechBill`");
    if (
      message.includes("Unknown argument `timelineMinMinutes`") ||
      message.includes("Unknown argument `timelineMaxMinutes`") ||
      message.includes("Unknown argument `timelineConfidence`") ||
      message.includes("Unknown argument `timelineNote`") ||
      legacyClientBillField ||
      legacyExternalBillField ||
      message.includes("Unknown argument `recommendationOption`") ||
      message.includes("Unknown argument `communicationStatus`") ||
      message.includes("Unknown argument `clientConversationNote`") ||
      message.includes("Unknown argument `lastClientContactAt`")
      || message.includes("Unknown argument `vatApplicable`")
      || message.includes("Unknown argument `statusNote`")
      || message.includes("Unknown argument `workflowReason`")
    ) {
      const fallbackData = { ...data } as Record<string, unknown>;
      delete fallbackData.timelineMinMinutes;
      delete fallbackData.timelineMaxMinutes;
      delete fallbackData.timelineConfidence;
      delete fallbackData.timelineNote;

      if (legacyClientBillField && "clientBill" in fallbackData) {
        fallbackData.finalCost = fallbackData.clientBill;
        delete fallbackData.clientBill;
      }
      if (legacyExternalBillField && "externalTechBill" in fallbackData) {
        fallbackData.costEstimate = fallbackData.externalTechBill;
        delete fallbackData.externalTechBill;
      }
      delete fallbackData.recommendationOption;
      delete fallbackData.communicationStatus;
      delete fallbackData.clientConversationNote;
      delete fallbackData.lastClientContactAt;
      delete fallbackData.vatApplicable;
      delete fallbackData.statusNote;
      delete fallbackData.workflowReason;

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
