"use server";

import {
  CommunicationStatus,
  JobStatus,
  RecommendationOption,
  RepairPath,
  Role,
  DeliveryMethod,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { hasJobPayoutColumns } from "@/lib/payouts";
import { sanitizeOptionalText } from "@/lib/sanitize";
import { getCurrentUserRole } from "@/lib/session";
import {
  notifyStatusChange,
  notifyApprovalNeeded,
  notifyJobAssigned,
  notifyEstimateSubmitted,
  notifyTimelineUpdate,
  notifyDelayNote,
} from "@/lib/notifications";

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
  deliveryMethod: z.enum(["PICKUP", "DELIVERY", "COURIER"]).optional(),
  deliveredTo: z.string().optional(),
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
  const permissionUser = { role: user.role, permissions: user.permissions };
  // INTAKE users are read-only by default (they create jobs, not edit them).
  // Exception: users who have been granted specific elevated permissions
  // (billing entry or technician assignment) pass through to those gates.
  const isReadOnlyIntake =
    user.role === "INTAKE" &&
    !can.editDiagnosis(permissionUser) &&
    !can.approveInvoices(permissionUser) &&
    !can.assignJobs(permissionUser);
  if (isReadOnlyIntake) {
    return { error: "Intake is read-only after job creation." };
  }
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
    READY_FOR_PICKUP: [JobStatus.DELIVERED, JobStatus.COMPLETED, JobStatus.CLOSED],
    DELIVERED: [JobStatus.COMPLETED, JobStatus.CLOSED],
  };

  if (payload.nextStatus) {
    const allowedForStatus = transitions[existing.status] ?? [];
    if (!allowedForStatus.includes(payload.nextStatus)) {
      return { error: "Invalid status transition" };
    }
  }

  const roleCanTransition = (role: Role, nextStatus: JobStatus) => {
    if (role === "ADMIN") return true;
    if (can.editDiagnosis(permissionUser)) {
      return (
        [
          JobStatus.DIAGNOSING,
          JobStatus.IN_REPAIR,
          JobStatus.READY_FOR_PICKUP,
          JobStatus.DELIVERED,
          JobStatus.COMPLETED,
          JobStatus.CLOSED,
        ] as JobStatus[]
      ).includes(nextStatus);
    }
    if (role === "TECHNICIAN_INTERNAL") {
      return (
        [
          JobStatus.DIAGNOSING,
          JobStatus.IN_REPAIR,
          JobStatus.READY_FOR_PICKUP,
          JobStatus.DELIVERED,
          JobStatus.COMPLETED,
          JobStatus.CLOSED,
        ] as JobStatus[]
      ).includes(nextStatus);
    }
    if (role === "TECHNICIAN_EXTERNAL") {
      return ([JobStatus.COMPLETED, JobStatus.DELIVERED] as JobStatus[]).includes(nextStatus);
    }
    if (role === "OPS") {
      return (
        [
          JobStatus.AWAITING_APPROVAL,
          JobStatus.CLOSED,
          JobStatus.IN_REPAIR,
          JobStatus.READY_FOR_PICKUP,
          JobStatus.DELIVERED,
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

  const canBypassAssignmentForPricing = can.approveInvoices(permissionUser);
  if (
    (user.role === "TECHNICIAN_EXTERNAL" || user.role === "TECHNICIAN_INTERNAL") &&
    existing.assignedToId !== session.user.id &&
    !canBypassAssignmentForPricing
  ) {
    return { error: "Forbidden" };
  }

  const payoutChangeRequested =
    payload.externalTechFee !== undefined ||
    payload.externalPaid !== undefined ||
    payload.externalPaymentRef !== undefined;
  const canManagePayouts = user.role === "ADMIN" || can.reviewExternalBills(permissionUser);

  const adminFinancialChangeRequested =
    payload.clientBill !== undefined || payload.vatApplicable !== undefined;

  if (adminFinancialChangeRequested && !can.approveInvoices(permissionUser)) {
    return { error: "Only authorized invoice approvers can update client billing controls." };
  }

  if (payoutChangeRequested && !canManagePayouts) {
    return { error: "Only authorized finance users can update payout controls." };
  }

  if (payoutChangeRequested && canManagePayouts) {
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
    if (can.assignJobs(permissionUser) && payload.assignedToId !== undefined) {
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
    if (can.approveInvoices(permissionUser)) {
      data.clientBill = payload.clientBill;
    }
    if (canManagePayouts) {
      data.externalTechFee = payload.externalTechFee;
      if (user.role === "ADMIN" && payload.vatApplicable !== undefined) {
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
    if (user.role === "ADMIN" || user.role === "OPS" || can.assignJobs(permissionUser)) {
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
    data.deliveredAt = payload.nextStatus === JobStatus.DELIVERED ? new Date() : undefined;
    if (payload.deliveryMethod) {
      data.deliveryMethod = payload.deliveryMethod;
    }
    if (payload.deliveredTo) {
      data.deliveredTo = sanitizeOptionalText(payload.deliveredTo) || null;
    }
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
      delete fallbackData.deliveredAt;
      delete fallbackData.deliveryMethod;
      delete fallbackData.deliveredTo;

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

  const job = await prisma.job.findUnique({
    where: { id: payload.jobId },
    include: { client: true, assignedTo: true },
  });

  if (!job) {
    return { success: true };
  }

  if (payload.nextStatus && payload.nextStatus !== job.status) {
    await notifyStatusChange(
      job.id,
      job.status,
      payload.nextStatus,
      job.jobNumber,
      job.client.fullName
    );
  }


  if (payload.assignedToId && payload.assignedToId !== job.assignedToId) {
    await notifyJobAssigned(
      job.id,
      job.jobNumber,
      `${job.brand} ${job.model}`,
      payload.assignedToId
    );
  }

  if (payload.repairTimeline) {
    await notifyTimelineUpdate(
      job.id,
      job.jobNumber,
      `${job.brand} ${job.model}`,
      payload.repairTimeline
    );
  }

  if (payload.timelineNote) {
    await notifyDelayNote(
      job.id,
      job.jobNumber,
      `${job.brand} ${job.model}`,
      payload.timelineNote
    );
  }

  revalidatePath(`/jobs/${payload.jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/technicians");
  revalidatePath("/dashboard");

  return { success: true };
}
