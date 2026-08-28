"use server";

import {
  CommunicationStatus,
  JobStatus,
  Prisma,
  RecommendationOption,
  RepairPath,
  Role,
  PaymentMethod,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma, ensureMoneySchema } from "@/lib/prisma";
import { findRecentDuplicate } from "@/lib/dedup";
import { resolveTechCost } from "@/lib/billing";
import { can } from "@/lib/permissions";
import { hasJobPayoutColumns } from "@/lib/payouts";
import { sanitizeOptionalText } from "@/lib/sanitize";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import {
  notifyStatusChange,
  notifyJobAssigned,
  notifyTimelineUpdate,
  notifyDelayNote,
  notifyPaymentReceived,
  notifyPayoutGenerated,
} from "@/lib/notifications";
import { deliverOutboundMessage, enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";
import { enqueueWhatsAppDocument, enqueueEmailDocument, type WhatsAppDocumentKind } from "@/lib/notifications/whatsapp-document-outbox";
import { generateQuotationBuffer } from "@/lib/pdf/generate-quotation";
import { generateAssessmentBuffer } from "@/lib/pdf/generate-assessment";
import { generateInvoiceBuffer } from "@/lib/pdf/generate-invoice";
import { generateJobCardBuffer } from "@/lib/pdf/generate-job-card";
import { nextAvailableInvoiceNumber, createReceiptForPayment } from "@/lib/commercial/document-workflow";
import { createDeliveryNoteFromInvoice } from "@/lib/commercial/delivery-note-from-invoice";
import { postRefund, postTechnicianPayout } from "@/lib/accounting/post";
import { writeJobStatusHistory } from "@/lib/commercial/job-workflow";
import { syncInvoicePaymentState } from "@/lib/commercial/payment-sync";
import { consumeRepairPartsForJob } from "@/lib/inventory/consume-repair-parts";
import { formatMoney, isSupportedCurrency, normalizeCurrency, toBaseAmount } from "@/lib/currency";
import { syncJobInvoiceLines } from "@/lib/commercial/job-invoice-lines";

import { clientDisplayName } from "@/lib/client-name";
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
  clientPaid: z.enum(["true", "false"]).optional(),
  clientPaymentRef: z.string().optional(),
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

// Strip commas and currency prefixes so "50,000" or "UGX 50,000" parses correctly
function parseAmount(value: unknown): number {
  const raw = typeof value === "string"
    ? value.replace(/[^\d.]/g, "").trim()  // remove anything that's not a digit or dot
    : String(value ?? "");
  return raw ? Number(raw) : NaN;
}

const recordClientPaymentSchema = z.object({
  jobId: z.string().min(1),
  amount: z.preprocess(parseAmount, z.number().positive("Enter a valid payment amount")),
  kind: z.enum(["PAYMENT", "DEPOSIT", "PARTIAL", "BALANCE", "REFUND", "ADJUSTMENT"]).default("PAYMENT"),
  method: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
  confirmOverpayment: z.enum(["true", "false"]).optional(),
  currency: z.string().optional(),
  exchangeRateToBase: z.preprocess(
    (value) => {
      const raw = typeof value === "string" ? value.trim() : "";
      if (!raw) return undefined;
      return Number(raw);
    },
    z.number().positive().optional(),
  ),
});

const recordTechnicianPayoutSchema = z.object({
  jobId: z.string().min(1),
  amount: z.preprocess(parseAmount, z.number().positive("Enter a valid payout amount")),
  method: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
  confirmOverpayment: z.enum(["true", "false"]).optional(),
});

const oneTimeExternalSchema = z.object({
  jobId: z.string().min(1),
  expectedUpdatedAt: z.string().optional(),
  technicianName: z.string().min(1),
  phone: z.string().min(3),
  specialization: z.string().optional(),
  agreedRepairCost: z.coerce.number().optional(),
  expectedPartsCost: z.coerce.number().optional(),
  partsNotes: z.string().optional(),
  assignedDate: z.string().min(1),
  expectedReturnDate: z.string().optional(),
  returnedDate: z.string().optional(),
  instructions: z.string().optional(),
  progressNotes: z.string().optional(),
  finalOutcome: z.string().optional(),
  outsourcingStatus: z.nativeEnum(JobStatus).optional(),
});

function toMiddayUtcDate(value: string | undefined) {
  if (!value) return null;
  // Expect YYYY-MM-DD (from <input type="date">). Use midday UTC to avoid timezone rollbacks.
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

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
  const { session, user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  const permissionUser = { role: user.role, permissions: user.permissions };
  // FRONT_DESK users are read-only by default (they create jobs, not edit them).
  // Exception: users who have been granted specific elevated permissions
  // (billing entry or technician assignment) pass through to those gates.
  const isReadOnlyIntake =
    user.role === "FRONT_DESK" &&
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
  // Select explicitly to avoid runtime failures if some newer columns (e.g. deviceId)
  // are not yet present in a given environment.
  const selectExistingBase = {
    id: true,
    updatedAt: true,
    status: true,
    assignedToId: true,
    repairPath: true,
    // billing + payouts
    clientBill: true,
    clientPaid: true,
    vatApplicable: true,
    externalTechFee: true,
    externalPaid: true,
    externalPaymentRef: true,
    // workflow + comms
    communicationStatus: true,
    clientConversationNote: true,
    workflowReason: true,
    statusNote: true,
    // diagnosis + repair
    diagnosisNotes: true,
    externalDiagnosis: true,
    partsNeeded: true,
    workDone: true,
    partsReplaced: true,
    // timeline
    repairTimeline: true,
    timelineNote: true,
    // approval fields (used by status transitions)
    clientApproved: true,
    approvalDate: true,
  } as const;

  const existing = await prisma.job
    .findUnique({
      where: { id: payload.jobId, orgId },
      select: {
        ...selectExistingBase,
        serviceType: true,
      },
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("serviceType")) {
        return prisma.job.findUnique({
          where: { id: payload.jobId, orgId },
          select: selectExistingBase,
        }) as unknown as Promise<(typeof selectExistingBase & { id: string }) | null>;
      }
      throw error;
    });
  if (!existing) {
    return { error: "Job not found" };
  }

  const existingServiceType =
    "serviceType" in existing && typeof (existing as { serviceType?: string }).serviceType === "string"
      ? ((existing as { serviceType?: string }).serviceType as string)
      : "HARDWARE";

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
    DIAGNOSING: [JobStatus.REFERRED, JobStatus.IN_REPAIR],
    REFERRED: [JobStatus.PENDING_EXTERNAL_ASSIGNMENT, JobStatus.ASSIGNED_ONE_TIME_EXTERNAL, JobStatus.IN_EXTERNAL_REPAIR, JobStatus.AWAITING_APPROVAL],
    PENDING_EXTERNAL_ASSIGNMENT: [JobStatus.ASSIGNED_ONE_TIME_EXTERNAL, JobStatus.IN_EXTERNAL_REPAIR, JobStatus.AWAITING_APPROVAL],
    ASSIGNED_ONE_TIME_EXTERNAL: [JobStatus.IN_EXTERNAL_REPAIR, JobStatus.AWAITING_APPROVAL],
    IN_EXTERNAL_REPAIR: [JobStatus.RETURNED_FROM_EXTERNAL, JobStatus.AWAITING_APPROVAL],
    WAITING_FOR_PARTS: [JobStatus.IN_REPAIR, JobStatus.CLOSED],
    RETURNED_FROM_EXTERNAL: [JobStatus.AWAITING_APPROVAL, JobStatus.IN_REPAIR],
    AWAITING_APPROVAL: [JobStatus.IN_REPAIR, JobStatus.CLOSED],
    IN_REPAIR: [JobStatus.WAITING_FOR_PARTS, JobStatus.READY_FOR_PICKUP, JobStatus.COMPLETED, JobStatus.CLOSED],
    READY_FOR_PICKUP: [JobStatus.DELIVERED, JobStatus.COMPLETED, JobStatus.CLOSED],
    DELIVERED: [JobStatus.COMPLETED],
  };

  if (payload.nextStatus) {
    const allowedForStatus = transitions[existing.status] ?? [];
    if (!allowedForStatus.includes(payload.nextStatus)) {
      return { error: "Invalid status transition" };
    }
  }

  const roleCanTransition = (role: Role, nextStatus: JobStatus) => {
    if (role === "ADMIN") return true;
    if (role === "TECHNICIAN_EXTERNAL") {
      return ([JobStatus.AWAITING_APPROVAL, JobStatus.RETURNED_FROM_EXTERNAL] as JobStatus[]).includes(nextStatus);
    }
    if (role === "TECHNICIAN_INTERNAL" || can.editDiagnosis(permissionUser)) {
      return (
        [
          JobStatus.DIAGNOSING,
          JobStatus.REFERRED,
          JobStatus.PENDING_EXTERNAL_ASSIGNMENT,
          JobStatus.ASSIGNED_ONE_TIME_EXTERNAL,
          JobStatus.IN_EXTERNAL_REPAIR,
          JobStatus.RETURNED_FROM_EXTERNAL,
          JobStatus.IN_REPAIR,
          JobStatus.WAITING_FOR_PARTS,
          JobStatus.READY_FOR_PICKUP,
          JobStatus.COMPLETED,
          JobStatus.CLOSED,
        ] as JobStatus[]
      ).includes(nextStatus);
    }
    if (role === "OPS") {
      return (
        [
          JobStatus.REFERRED,
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

  const clientPaymentChangeRequested =
    payload.clientPaid !== undefined || payload.clientPaymentRef !== undefined;

  const adminFinancialChangeRequested =
    payload.clientBill !== undefined || payload.vatApplicable !== undefined;

  if (adminFinancialChangeRequested && !can.approveInvoices(permissionUser)) {
    return { error: "Only authorized invoice approvers can update client billing controls." };
  }

  if (clientPaymentChangeRequested && !can.approveInvoices(permissionUser)) {
    return { error: "Only authorized users can record client payment status." };
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
    data.repairTimeline = timeline?.repairTimeline ?? (sanitizeOptionalText(payload.repairTimeline) || undefined);
    data.timelineMinMinutes = timeline?.timelineMinMinutes;
    data.timelineMaxMinutes = timeline?.timelineMaxMinutes;
    data.timelineConfidence = payload.timelineConfidence;
    data.timelineNote = sanitizeOptionalText(payload.timelineNote) || undefined;
    data.externalTechBill = payload.externalTechBill;
    if (payload.nextStatus === JobStatus.AWAITING_APPROVAL || payload.nextStatus === JobStatus.RETURNED_FROM_EXTERNAL) {
      data.status = payload.nextStatus;
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
        data.repairPath = null; // Clear stale path when technician is removed
      } else {
        const assignee = await prisma.user.findFirst({
          where: {
            id: assigneeId,
            orgId,
            isActive: true,
            role: { in: [Role.TECHNICIAN_INTERNAL, Role.TECHNICIAN_EXTERNAL] },
          },
          select: { id: true, role: true },
        });

        if (!assignee) {
          return { error: "Invalid assignee. Select an active technician." };
        }

        // Software services are internal-only.
        if (existingServiceType !== "HARDWARE" && assignee.role === Role.TECHNICIAN_EXTERNAL) {
          return { error: "Software jobs cannot be assigned to external technicians." };
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
    if (clientPaymentChangeRequested && can.approveInvoices(permissionUser)) {
      if (payload.clientPaid !== undefined) {
        const isPaid = payload.clientPaid === "true";
        data.clientPaid = isPaid;
        data.clientPaidAt = isPaid ? new Date() : null;
        data.clientPaidById = isPaid ? session.user.id : null;
      }
      if (payload.clientPaymentRef !== undefined) {
        data.clientPaymentRef = sanitizeOptionalText(payload.clientPaymentRef) || null;
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
    const isUnresolvedNoChargeClose =
      payload.nextStatus === JobStatus.CLOSED && payload.workflowReason === "UNREPAIRABLE";

    if (isUnresolvedNoChargeClose) {
      data.clientBill = 0;
      data.clientPaid = true;
      data.clientPaidAt = new Date();
      data.clientPaidById = session.user.id;
    }

    if (payload.nextStatus === JobStatus.COMPLETED || payload.nextStatus === JobStatus.CLOSED) {
      // Determine the bill that will be in effect after this update.
      const incomingBill = typeof data.clientBill === "number" ? data.clientBill : undefined;
      const priorBill =
        typeof (existing as { clientBill?: number | null }).clientBill === "number"
          ? (existing as { clientBill?: number | null }).clientBill
          : null;
      const finalBill = incomingBill !== undefined ? incomingBill : priorBill;
      // No charge — mark client payment settled so the job is excluded from collection queues.
      if (finalBill === null || finalBill === 0) {
        data.clientPaid = true;
        data.clientPaidAt = new Date();
        data.clientPaidById = session.user.id;
      }
    }
    // Delivery fields should only be captured at the end of the workflow.
    // DELIVERED status is deprecated in UI; keep deliveredAt only when staff set it explicitly.
    data.deliveredAt = undefined;
    const isTerminalTransition = payload.nextStatus === JobStatus.COMPLETED || payload.nextStatus === JobStatus.CLOSED;
    if (isTerminalTransition && payload.deliveryMethod) {
      data.deliveryMethod = payload.deliveryMethod;
    }
    if (isTerminalTransition && payload.deliveredTo) {
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
      where: { id: payload.jobId, orgId },
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
      || message.includes("Unknown argument `clientPaid`")
      || message.includes("Unknown argument `clientPaymentRef`")
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
      delete fallbackData.clientPaid;
      delete fallbackData.clientPaidAt;
      delete fallbackData.clientPaidById;
      delete fallbackData.clientPaymentRef;

      updated = await (prisma.job as unknown as {
        update: (args: { where: { id: string; orgId: string }; data: Record<string, unknown> }) => Promise<{
          id: string;
        }>;
      }).update({
        // Keep org scoping on the fallback path too — dropping it would allow a
        // cross-tenant write on a drifted DB.
        where: { id: payload.jobId, orgId },
        data: fallbackData,
      });
    } else {
      throw error;
    }
  }

  await prisma.auditLog.create({
    data: {
      orgId,
      jobId: updated.id,
      userId: session.user.id,
      action: data.status ? "STATUS_CHANGED" : "JOB_UPDATED",
      detail: JSON.stringify({ requestedStatus: payload.nextStatus ?? null, fromStatus: existing.status, toStatus: data.status ?? existing.status }),
    },
  });

  // On completion, decrement stock for the parts on the accepted quotation.
  // Best-effort + idempotent: a stock-write failure must not block the repair
  // from completing, and re-entering COMPLETED never double-consumes.
  if (payload.nextStatus === JobStatus.COMPLETED && existing.status !== JobStatus.COMPLETED) {
    await consumeRepairPartsForJob({ orgId, jobId: payload.jobId, userId: session.user.id }).catch((error) => {
      console.error("[jobs] repair parts consumption failed", error);
    });

    // Auto-issue the client invoice on completion, so a finished repair lands
    // straight in Invoice Collections instead of the un-invoiced Client Payments
    // list. Idempotent (generateInvoiceBuffer upserts the Invoice by jobId) and
    // best-effort — an invoicing hiccup must never block the job from completing.
    const effectiveClientBill = (updated as { clientBill?: number | null }).clientBill ?? 0;
    if (effectiveClientBill > 0) {
      await generateInvoiceBuffer(payload.jobId, user.name ?? "System", user.role, session.user.id, orgId, {
        persistInvoiceRecord: true,
      }).catch((error) => {
        console.error("[jobs] auto-invoice on completion failed", error);
      });
    }
  }

  const job =
    user.role === "TECHNICIAN_EXTERNAL"
      ? await prisma.job.findUnique({
          where: { id: payload.jobId, orgId },
          select: {
            id: true,
            jobNumber: true,
            status: true,
            assignedToId: true,
            brand: true,
            model: true,
            repairTimeline: true,
            timelineNote: true,
            assignedTo: { select: { id: true, name: true, role: true } },
          },
        })
      : await prisma.job.findUnique({
          where: { id: payload.jobId, orgId },
          select: {
            id: true,
            jobNumber: true,
            status: true,
            assignedToId: true,
            brand: true,
            model: true,
            repairTimeline: true,
            timelineNote: true,
            client: { select: { fullName: true, phone: true, organization: true } },
            assignedTo: { select: { id: true, name: true, role: true } },
          },
        });

  const statusChangedTo =
    payload.nextStatus && payload.nextStatus !== existing.status ? payload.nextStatus : undefined;

  if (!job) {
    console.error("[updateJobAction] job fetch after update returned null — notifications skipped", { jobId: existing.id });
    return {
      success: true,
      warn: "Job updated but post-update fetch failed — notifications may not have fired.",
      statusChangedTo,
    };
  }

  // Notifications must compare against the pre-update snapshot.
  // `job` is fetched after the update, so compare to `existing`.
  if (existing.status !== job.status) {
    const clientName =
      user.role === "TECHNICIAN_EXTERNAL"
        ? "Client"
        : clientDisplayName((await prisma.job.findUnique({
            where: { id: job.id, orgId },
            select: { client: { select: { fullName: true, organization: true } } },
          }))?.client ?? null, "Client");
    await notifyStatusChange(orgId, job.id, existing.status, job.status, job.jobNumber, clientName);
    // Record the transition so the client portal (and staff) can show a real
    // repair timeline. Additive + best-effort — never blocks the status change.
    await writeJobStatusHistory({
      orgId,
      jobId: job.id,
      fromStatus: existing.status,
      toStatus: job.status,
      changedById: user.id,
    });
  }

  if (existing.assignedToId !== job.assignedToId && job.assignedToId) {
    await notifyJobAssigned(orgId, job.id, job.jobNumber, `${job.brand} ${job.model}`, job.assignedToId);
  }

  if (existing.repairTimeline !== job.repairTimeline && job.repairTimeline) {
    await notifyTimelineUpdate(orgId, job.id, job.jobNumber, `${job.brand} ${job.model}`, job.repairTimeline);
  }

  if (existing.timelineNote !== (job as typeof job & { timelineNote?: string | null }).timelineNote) {
    const nextNote = (job as typeof job & { timelineNote?: string | null }).timelineNote;
    if (nextNote) {
      await notifyDelayNote(orgId, job.id, job.jobNumber, `${job.brand} ${job.model}`, nextNote);
    }
  }

  revalidatePath(`/jobs/${payload.jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/technicians");
  revalidatePath("/dashboard");

  const resolvedStatusChangedTo =
    existing.status !== job.status ? job.status : statusChangedTo;

  return { success: true, statusChangedTo: resolvedStatusChangedTo };
}

export async function recordClientPaymentAction(formData: FormData) {
  const { session, user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });
  const permissionUser = { role: user.role, permissions: user.permissions };
  if (!can.approveInvoices(permissionUser)) {
    return { error: "Forbidden" };
  }

  const parsed = recordClientPaymentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payment" };
  }

  const payload = parsed.data;

  const baseCurrency = org.baseCurrency;
  const currency = normalizeCurrency(payload.currency, baseCurrency);
  if (!isSupportedCurrency(currency)) {
    return { error: "Unsupported currency" };
  }
  const exchangeRateToBase = currency === baseCurrency ? null : (payload.exchangeRateToBase ?? null);
  if (currency !== baseCurrency) {
    if (!exchangeRateToBase || !Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0) {
      return { error: `Exchange rate is required for ${currency} payments` };
    }
  }

  const job = await prisma.job.findUnique({
    where: { id: payload.jobId, orgId },
    select: {
      id: true,
      jobNumber: true,
      status: true,
      clientBill: true,
      clientId: true,
      invoiceNumber: true,
      invoiceIssuedAt: true,
      externalTechBill: true,
      // Everything the invoice lines are composed from.
      brand: true,
      model: true,
      serviceType: true,
      issueDescription: true,
      vatApplicable: true,
      softwareOsInstall: true,
      softwareDriversUpdates: true,
      softwareDataBackupRestore: true,
      softwareAccountSetup: true,
      softwarePerformanceTune: true,
      softwareThirdPartyApps: true,
    },
  });
  if (!job) return { error: "Job not found" };
  const totalAmount = typeof job.clientBill === "number" ? job.clientBill : 0;
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: "Set client bill before recording payment" };
  }

  const rawMethod = String(payload.method ?? "CASH").trim();
  const safeMethod: PaymentMethod = (Object.values(PaymentMethod) as string[]).includes(rawMethod)
    ? (rawMethod as PaymentMethod)
    : PaymentMethod.OTHER;
  const reference = (payload.reference ?? "").trim();
  const note = sanitizeOptionalText(payload.note) || null;

  // Ensure invoice exists (upsert by jobId). Reuse the job's already-stamped
  // invoice number when present; otherwise nextAvailableInvoiceNumber mints a
  // clean org-scoped number (EIS/INV/YYYY/SEQ) below.
  const issuedAt = job.invoiceIssuedAt ?? new Date();
  const invoiceNumber = job.invoiceNumber?.trim() || undefined;

  // Ensure the FX column + cash-basis ledger tables exist before opening the
  // transaction; a missing column/table would otherwise abort the whole payment
  // (SQLite rolls back the transaction on the first failed statement).
  await ensureMoneySchema();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.invoice.findFirst({
        where: { orgId, jobId: job.id },
        select: { id: true, invoiceNumber: true },
      });
      const safeInvoiceNumber = await nextAvailableInvoiceNumber(
        tx,
        orgId,
        existingInvoice?.invoiceNumber ?? invoiceNumber,
        existingInvoice?.id,
      );
      // clientId must be carried over from the job: the client statement and
      // every receivables view query invoices by clientId, so an invoice without
      // it is invisible on the client's account no matter what it is worth.
      const invoice = existingInvoice
        ? await tx.invoice.update({
            where: { id: existingInvoice.id },
            data: {
              invoiceNumber: safeInvoiceNumber,
              issuedAt,
              currency: baseCurrency,
              totalAmount,
              ...(job.clientId ? { clientId: job.clientId } : {}),
            },
            select: { id: true, totalAmount: true },
          })
        : await tx.invoice.create({
            data: {
              orgId,
              jobId: job.id,
              clientId: job.clientId,
              invoiceNumber: safeInvoiceNumber,
              issuedAt,
              currency: baseCurrency,
              totalAmount,
              paidAmount: 0,
              status: "ISSUED",
            },
            select: { id: true, totalAmount: true },
          });

      // Itemise the repair. Without lines the invoice is a bare total: it can't
      // be credited line by line, and the PDF prints a subtotal nothing accounts
      // for. Regenerated each time because clientBill can change before the job
      // closes; the lines always sum back to the same total.
      await syncJobInvoiceLines(tx, {
        orgId,
        invoiceId: invoice.id,
        job,
        clientBill: totalAmount,
        currency: baseCurrency,
      });

      if (job.invoiceNumber !== safeInvoiceNumber || !job.invoiceIssuedAt) {
        await tx.job.updateMany({
          where: { id: job.id, orgId },
          data: {
            invoiceNumber: safeInvoiceNumber,
            invoiceIssuedAt: issuedAt,
          },
        });
      }

      const [existingPayments, existingRefunds] = await Promise.all([
        tx.payment.findMany({
          where: { orgId, invoiceId: invoice.id },
          select: { amount: true, currency: true, exchangeRateToBase: true, kind: true },
        }),
        // Refunds issued through Documents → Refunds also reduce what is left to
        // give back; counting only Payment rows would let the same money go out
        // twice, once down each path.
        tx.refund.findMany({
          where: { orgId, invoiceId: invoice.id },
          select: { amount: true, currency: true, exchangeRateToBase: true },
        }),
      ]);
      const existingPaidAmount =
        existingPayments.reduce(
          (sum, p) => sum + (p.kind === "REFUND" ? -1 : 1) * toBaseAmount({ amount: p.amount, currency: p.currency, baseCurrency, exchangeRateToBase: p.exchangeRateToBase }),
          0,
        ) -
        existingRefunds.reduce(
          (sum, r) => sum + toBaseAmount({ amount: r.amount, currency: r.currency, baseCurrency, exchangeRateToBase: r.exchangeRateToBase }),
          0,
        );
      const signedAmount = payload.kind === "REFUND" ? -payload.amount : payload.amount;
      const nextPaidAmount = existingPaidAmount + toBaseAmount({ amount: signedAmount, currency, baseCurrency, exchangeRateToBase });
      if (nextPaidAmount > invoice.totalAmount && payload.confirmOverpayment !== "true") {
        throw new Error("This payment will overpay the client bill. Tick confirm overpayment if this is intentional.");
      }
      // Only the upper bound was checked, so refunding more than was ever paid
      // drove paidAmount negative and every outstanding balance in the app then
      // read HIGHER than the invoice total.
      if (nextPaidAmount < 0) {
        throw new Error(
          `That refund is more than has been paid on this bill. At most ${formatMoney(Math.max(0, existingPaidAmount), baseCurrency)} can be refunded.`,
        );
      }

      // Double-submit guard: an identical payment on this invoice landed seconds
      // ago (impatient click on a slow server) — don't record the money twice.
      const dupPayment = await findRecentDuplicate(tx.payment, {
        orgId,
        invoiceId: invoice.id,
        amount: payload.amount,
        method: safeMethod,
        kind: payload.kind,
      });
      if (dupPayment) {
        return {
          paidAmount: existingPaidAmount,
          isPaid: existingPaidAmount >= invoice.totalAmount,
          invoiceNumber: safeInvoiceNumber,
          deduped: true,
        };
      }

      const payment = await tx.payment.create({
        data: {
          orgId,
          invoiceId: invoice.id,
          saleId: null,
          currency,
          exchangeRateToBase,
          amount: payload.amount,
          method: safeMethod,
          kind: payload.kind,
          reference: reference || null,
          note,
          createdById: session.user.id,
        },
        select: { id: true },
      });

      // Generate a receipt for real payments (not refunds), like the invoice and
      // POS flows. The job payment path previously created none, so most repair
      // payments had no receipt document.
      if (payload.kind !== "REFUND") {
        await createReceiptForPayment(tx, {
          orgId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          clientId: job.clientId ?? null,
          amount: payload.amount,
          currency,
          issuedById: session.user.id,
        });
      } else {
        // C5: a repair-tab refund pays cash out — post the ledger reversal so the
        // P&L/cash reports stay complete. Keyed on the payment id (posts once).
        await postRefund(tx, {
          orgId,
          userId: session.user.id,
          // Ledger posts in base currency — convert a foreign refund (no-op in base).
          amount: toBaseAmount({ amount: payload.amount, currency, baseCurrency, exchangeRateToBase }),
          reference: `pay:${payment.id}`,
          description: `Refund on job invoice ${safeInvoiceNumber}`,
        });
      }

      const { paidAmount, isPaid } = await syncInvoicePaymentState(tx, {
        orgId,
        invoiceId: invoice.id,
        baseCurrency,
        actorUserId: session.user.id,
        clientPaymentRef: reference || null,
      });

      await tx.job.updateMany({
        where: { id: job.id, orgId },
        data: {
          // Use the collision-checked number, not the raw derived one, so the
          // job's invoiceNumber (a @unique column) always matches its invoice.
          invoiceNumber: safeInvoiceNumber,
          invoiceIssuedAt: issuedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId,
          jobId: job.id,
          userId: session.user.id,
          action: "CLIENT_PAYMENT_RECORDED",
          detail: JSON.stringify({ amount: payload.amount, kind: payload.kind, method: safeMethod, reference: reference || null, paidAmount }),
        },
      });

      return { paidAmount, isPaid, invoiceNumber: safeInvoiceNumber, deduped: false };
    });

    revalidatePath(`/jobs/${job.id}`);
    revalidatePath("/documents/invoices");
    revalidatePath("/reports");
    revalidatePath("/dashboard");
    if (!result.deduped) {
      notifyPaymentReceived({
        orgId,
        // Client gets a confirmation for real payments only, not refunds.
        jobId: payload.kind === "REFUND" ? undefined : job.id,
        jobNumber: job.jobNumber,
        amount: payload.amount,
        currency: org.baseCurrency,
        actorName: user.name ?? user.email ?? "Unknown",
      }).catch(() => {});
    }
    return { ok: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record payment";
    return { error: message };
  }
}

export async function recordTechnicianPayoutAction(formData: FormData) {
  try {
    const { session, user, orgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });
    const permissionUser = { role: user.role, permissions: user.permissions };
    if (!(user.role === "ADMIN" || can.reviewExternalBills(permissionUser))) return { error: "Forbidden" };

    const parsed = recordTechnicianPayoutSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid payout" };
    const payload = parsed.data;

    const job = await prisma.job.findUnique({
      where: { id: payload.jobId, orgId },
      select: { id: true, jobNumber: true, externalTechBill: true, externalTechFee: true, assignedToId: true },
    });
    if (!job) return { error: "Job not found" };

    const technicianCost = resolveTechCost(job.externalTechFee, job.externalTechBill);
    const existingPayouts = await prisma.technicianPayout
      .findMany({ where: { orgId, jobId: job.id }, select: { amount: true } })
      .catch(() => []);
    const alreadyPaid = existingPayouts.reduce((sum, p) => sum + p.amount, 0);
    if (technicianCost > 0 && alreadyPaid + payload.amount > technicianCost && payload.confirmOverpayment !== "true") {
      return { error: "This payout is higher than the technician cost. Tick confirm overpayment if this is intentional." };
    }

    const rawMethod = String(payload.method ?? "CASH").trim();
    const safeMethod: PaymentMethod = (Object.values(PaymentMethod) as string[]).includes(rawMethod)
      ? (rawMethod as PaymentMethod)
      : PaymentMethod.OTHER;

    // Ledger post below needs the C5 accounting tables present before the txn.
    await ensureMoneySchema();

    await prisma.$transaction(async (tx) => {
      const payout = await tx.technicianPayout.create({
        data: {
          orgId,
          jobId: job.id,
          amount: payload.amount,
          method: safeMethod,
          reference: sanitizeOptionalText(payload.reference) || null,
          note: sanitizeOptionalText(payload.note) || null,
          recordedById: session.user.id,
        },
        select: { id: true },
      });

      // Cash-basis ledger: cash physically leaves the till, so debit the expense
      // and credit Cash (idempotent on the payout id).
      await postTechnicianPayout(tx, {
        orgId,
        userId: session.user.id,
        amount: payload.amount,
        reference: `techpay:${payout.id}`,
        description: `Technician payout · ${job.jobNumber}`,
      });

      const paidTotal = alreadyPaid + payload.amount;
      const isSettled = technicianCost > 0 && paidTotal >= technicianCost;
      await tx.job.updateMany({
        where: { id: job.id, orgId },
        data: {
          externalPaid: isSettled,
          externalPaidAt: isSettled ? new Date() : null,
          externalPaidById: isSettled ? session.user.id : null,
        },
      });
      await tx.auditLog.create({
        data: {
          orgId,
          jobId: job.id,
          userId: session.user.id,
          action: "TECHNICIAN_PAYOUT_RECORDED",
          detail: JSON.stringify({ amount: payload.amount, method: safeMethod, technicianCost, paidTotal }),
        },
      }).catch((err) => console.error("[recordTechnicianPayout] audit log failed:", err));
    });

    revalidatePath(`/jobs/${job.id}`);
    revalidatePath("/technicians/payouts");
    revalidatePath("/payout-followups");
    revalidatePath("/reports");
    revalidatePath("/dashboard");
    // Notify — resolve tech name asynchronously, don't block
    if (job.assignedToId) {
      prisma.user.findUnique({ where: { id: job.assignedToId }, select: { name: true } })
        .then((tech) => notifyPayoutGenerated({
          orgId,
          jobNumber: job.jobNumber,
          techName: tech?.name ?? "Technician",
          amount: payload.amount,
          actorName: user.name ?? user.email ?? "Unknown",
        }))
        .catch(() => {});
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record technician payout";
    return { error: message };
  }
}

export async function updateOneTimeExternalAssignmentAction(formData: FormData) {
  const { session, user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  const permissionUser = { role: user.role, permissions: user.permissions };

  if (!(user.role === "ADMIN" || user.role === "OPS" || can.assignJobs(permissionUser))) {
    return { error: "Forbidden" };
  }

  const supportsOneTimeExternal = Boolean(
    Prisma.dmmf.datamodel.models
      .find((model) => model.name === "Job")
      ?.fields.some((field) => field.name === "oneTimeExternalAssignment"),
  );

  if (!supportsOneTimeExternal) {
    return { error: "One-time external assignments are not available (Prisma client is out of date). Restart and run prisma generate." };
  }

  const parsed = oneTimeExternalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const payload = parsed.data;
  const allowedOutsourceStatuses = new Set<JobStatus>([
    JobStatus.REFERRED,
    JobStatus.PENDING_EXTERNAL_ASSIGNMENT,
    JobStatus.ASSIGNED_ONE_TIME_EXTERNAL,
    JobStatus.IN_EXTERNAL_REPAIR,
    JobStatus.RETURNED_FROM_EXTERNAL,
    JobStatus.AWAITING_APPROVAL,
  ]);

  const existing = await prisma.job
    .findUnique({
      where: { id: payload.jobId, orgId },
      select: { id: true, updatedAt: true, status: true, serviceType: true },
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("serviceType")) {
        return prisma.job.findUnique({
          where: { id: payload.jobId, orgId },
          select: { id: true, updatedAt: true, status: true },
        }) as unknown as Promise<({ id: string; updatedAt: Date; status: JobStatus } & { serviceType?: string }) | null>;
      }
      throw error;
    });

  if (!existing) {
    return { error: "Job not found" };
  }

  const existingServiceType =
    "serviceType" in existing && typeof (existing as { serviceType?: string }).serviceType === "string"
      ? ((existing as { serviceType?: string }).serviceType as string)
      : "HARDWARE";

  if (existingServiceType !== "HARDWARE") {
    return { error: "Software jobs cannot be outsourced to one-time external technicians." };
  }

  if (payload.expectedUpdatedAt) {
    const expected = new Date(payload.expectedUpdatedAt).toISOString();
    const actual = existing.updatedAt.toISOString();
    if (expected !== actual) {
      return { error: "This job changed since you opened it. Refresh and try again." };
    }
  }

  const nextStatus = payload.outsourcingStatus;
  if (nextStatus && !allowedOutsourceStatuses.has(nextStatus)) {
    return { error: "Invalid outsourcing status" };
  }

  const assignedAt = toMiddayUtcDate(payload.assignedDate);
  if (!assignedAt) {
    return { error: "Invalid assigned date" };
  }

  const expectedReturnAt = toMiddayUtcDate(payload.expectedReturnDate);
  const returnedAt = toMiddayUtcDate(payload.returnedDate);

  const baseAssignmentData = {
    technicianName: payload.technicianName.trim(),
    phone: payload.phone.trim(),
    specialization: sanitizeOptionalText(payload.specialization) || null,
    agreedRepairCost: typeof payload.agreedRepairCost === "number" ? payload.agreedRepairCost : null,
    expectedPartsCost: typeof payload.expectedPartsCost === "number" ? payload.expectedPartsCost : null,
    partsNotes: sanitizeOptionalText(payload.partsNotes) || null,
    assignedAt,
    expectedReturnAt,
    instructions: sanitizeOptionalText(payload.instructions) || null,
    progressNotes: sanitizeOptionalText(payload.progressNotes) || null,
    finalOutcome: sanitizeOptionalText(payload.finalOutcome) || null,
  };

  const createAssignmentData = {
    ...baseAssignmentData,
    returnedAt: returnedAt ?? null,
  };

  const updateAssignmentData: Record<string, unknown> = {
    ...baseAssignmentData,
  };

  // Only touch returnedAt when explicitly set, or when we are auto-marking the handover.
  if (returnedAt) {
    updateAssignmentData.returnedAt = returnedAt;
  }

  const jobUpdate: Record<string, unknown> = {
    repairPath: RepairPath.EXTERNAL,
    assignedToId: null,
  };

  if (nextStatus) {
    jobUpdate.status = nextStatus;
  } else if (existing.status === JobStatus.DIAGNOSING) {
    jobUpdate.status = JobStatus.REFERRED;
  }

  try {
    await prisma.$transaction([
      prisma.oneTimeExternalTechAssignment.upsert({
        where: { jobId: payload.jobId },
        create: { jobId: payload.jobId, ...createAssignmentData },
        update: updateAssignmentData,
      }),
      prisma.job.update({ where: { id: payload.jobId, orgId }, data: jobUpdate }),
      prisma.auditLog.create({
        data: {
          orgId,
          jobId: payload.jobId,
          userId: session.user.id,
          action: "ONE_TIME_EXTERNAL_UPDATED",
          detail: JSON.stringify({ ...payload, assignedAt: payload.assignedDate }),
        },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("no such table") || message.toLowerCase().includes("onetimeexternaltechassignment")) {
      return { error: "One-time external assignments are not yet deployed to this database. Apply the latest schema changes and try again." };
    }
    return { error: "Failed to save one-time external assignment" };
  }

  revalidatePath(`/jobs/${payload.jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function markMessagesReadAction(jobId: string): Promise<void> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS", "FRONT_DESK"].includes(user.role)) return;

  const job = await prisma.job.findFirst({ where: { id: jobId, orgId }, select: { id: true } });
  if (!job) return;

  try {
    await prisma.inboundMessage.updateMany({
      where: { jobId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  } catch {
    // inboundMessage table may not exist yet on older deployments — safe to ignore
  }

  revalidatePath(`/jobs/${jobId}`);
}

export async function sendManualReplyAction(
  jobId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS", "FRONT_DESK"].includes(user.role)) {
    return { success: false, error: "Not authorised" };
  }

  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 4000) {
    return { success: false, error: "Message must be between 1 and 4000 characters" };
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId, orgId },
    select: { client: { select: { phone: true } } },
  });

  if (!job?.client?.phone) {
    return { success: false, error: "No client phone number on this job" };
  }

  const result = await enqueueWhatsAppMessage({
    orgId,
    to: job.client.phone,
    body: trimmed,
    type: "STAFF_REPLY",
    jobId,
  });

  if ("outboxId" in result && result.outboxId) {
    await deliverOutboundMessage(result.outboxId);
  }

  revalidatePath(`/jobs/${jobId}`);
  return { success: true };
}

async function sendPdfViaWhatsApp(opts: {
  jobId: string;
  userId: string;
  filename: string;
  clientPhone: string;
  caption: string;
  outboxBody: string;
  documentKind: WhatsAppDocumentKind;
  stampQuotedAt?: boolean;
  staffName: string;
  staffRole: string;
  auditAction: string;
  auditDetail: Record<string, string>;
  orgId: string;
}): Promise<{ success: boolean; error?: string }> {
  const enqueued = await enqueueWhatsAppDocument({
    orgId: opts.orgId,
    to: opts.clientPhone,
    body: opts.outboxBody,
    jobId: opts.jobId,
    document: {
      documentKind: opts.documentKind,
      filename: opts.filename,
      caption: opts.caption,
      staffName: opts.staffName,
      staffRole: opts.staffRole,
      staffUserId: opts.userId,
      stampQuotedAt: opts.stampQuotedAt,
      auditAction: opts.auditAction,
      auditDetail: opts.auditDetail,
    },
  });

  if (!enqueued.outboxId) {
    if ("sent" in enqueued && enqueued.sent) {
      revalidatePath(`/jobs/${opts.jobId}`);
      return { success: true };
    }
    return { success: false, error: enqueued.error ?? "Failed to queue WhatsApp document" };
  }

  const delivery = await deliverOutboundMessage(enqueued.outboxId);
  if (delivery.ok && "sent" in delivery && delivery.sent) {
    revalidatePath(`/jobs/${opts.jobId}`);
    return { success: true };
  }

  const outboxRow = await prisma.outboundMessage.findUnique({
    where: { id: enqueued.outboxId },
    select: { lastError: true },
  }).catch(() => null);

  revalidatePath(`/jobs/${opts.jobId}`);
  return {
    success: false,
    error: outboxRow?.lastError ?? ("error" in delivery ? delivery.error : undefined) ?? "Document send failed",
  };
}

/** Email sibling of {@link sendPdfViaWhatsApp}: the PDF is attached to the email. */
async function sendPdfViaEmail(opts: {
  jobId: string;
  userId: string;
  clientEmail: string;
  filename: string;
  subject: string;
  emailBody: string;
  documentKind: WhatsAppDocumentKind;
  stampQuotedAt?: boolean;
  staffName: string;
  staffRole: string;
  auditAction: string;
  auditDetail: Record<string, string>;
  orgId: string;
}): Promise<{ success: boolean; error?: string }> {
  const enqueued = await enqueueEmailDocument({
    orgId: opts.orgId,
    to: opts.clientEmail,
    subject: opts.subject,
    body: opts.emailBody,
    jobId: opts.jobId,
    document: {
      documentKind: opts.documentKind,
      filename: opts.filename,
      caption: opts.subject,
      staffName: opts.staffName,
      staffRole: opts.staffRole,
      staffUserId: opts.userId,
      stampQuotedAt: opts.stampQuotedAt,
      auditAction: opts.auditAction,
      auditDetail: opts.auditDetail,
    },
  });

  if (!enqueued.outboxId) {
    if ("sent" in enqueued && enqueued.sent) {
      revalidatePath(`/jobs/${opts.jobId}`);
      return { success: true };
    }
    return { success: false, error: enqueued.error ?? "Failed to queue email document" };
  }

  const delivery = await deliverOutboundMessage(enqueued.outboxId);
  if (delivery.ok && "sent" in delivery && delivery.sent) {
    revalidatePath(`/jobs/${opts.jobId}`);
    return { success: true };
  }

  const outboxRow = await prisma.outboundMessage.findUnique({
    where: { id: enqueued.outboxId },
    select: { lastError: true },
  }).catch(() => null);

  revalidatePath(`/jobs/${opts.jobId}`);
  return {
    success: false,
    error: outboxRow?.lastError ?? ("error" in delivery ? delivery.error : undefined) ?? "Document send failed",
  };
}

/** Fetch the job's client email for an email send; returns "" when absent. */
async function jobClientEmail(jobId: string, orgId: string): Promise<string> {
  const job = await prisma.job
    .findFirst({ where: { id: jobId, orgId }, select: { client: { select: { email: true } } } })
    .catch(() => null);
  return job?.client?.email ?? "";
}

export async function sendQuotationViaWhatsAppAction(
  jobId: string,
): Promise<{ success: boolean; error?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS", "FRONT_DESK"].includes(user.role)) {
    return { success: false, error: "Not authorised" };
  }
  const result = await generateQuotationBuffer(jobId, user.name, user.role, true, user.id, orgId);
  if (!result.ok) return { success: false, error: result.error };
  return sendPdfViaWhatsApp({
    jobId, userId: user.id, orgId,
    filename: result.filename, clientPhone: result.clientPhone,
    caption: `Please find your quotation (${result.quotationNumber}) attached.`,
    outboxBody: `[Quotation PDF] ${result.quotationNumber}`,
    documentKind: "quotation",
    stampQuotedAt: true,
    staffName: user.name,
    staffRole: user.role,
    auditAction: "QUOTATION_SENT_WHATSAPP",
    auditDetail: { quotationNumber: result.quotationNumber },
  });
}

export async function issueJobInvoiceAction(
  jobId: string,
): Promise<{ success: true; invoiceNumber: string } | { success: false; error: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS"].includes(user.role) && !can.approveInvoices({ role: user.role, permissions: user.permissions })) {
    return { success: false, error: "Not authorised" };
  }

  const result = await generateInvoiceBuffer(jobId, user.name, user.role, user.id, orgId, {
    persistInvoiceRecord: true,
  });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/documents/invoices");
  revalidatePath("/dashboard");

  return { success: true, invoiceNumber: result.invoiceNumber };
}

// One-click delivery note straight from the job: reuse the job's invoice and
// the deliveredTo/deliveryMethod already captured at handover, so the user
// never leaves the job for /documents/delivery-notes and re-types data the
// system already has.
//
// The creation itself is createDeliveryNoteFromInvoice, shared with the
// documents page, the invoice page and the API route. This function used to
// mirror that logic by hand, which is how the four copies drifted: two grew a
// "fully paid" gate and this one did not, so whether a handover slip could be
// issued depended on which screen you started from. What stays here is the
// part that is genuinely the job's — who received the device and how it left.
export async function generateJobDeliveryNoteAction(
  jobId: string,
): Promise<{ success: boolean; error?: string; deliveryNoteNumber?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS"].includes(user.role) && !can.approveInvoices({ role: user.role, permissions: user.permissions })) {
    return { success: false, error: "Not authorised" };
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    // Only what this function still decides. The line items, the existing-note
    // check and the fallback description all moved into the shared helper,
    // which reads them from the invoice itself.
    select: {
      deliveredTo: true,
      deliveryMethod: true,
      client: { select: { fullName: true } },
      invoice: { select: { id: true } },
    },
  });
  if (!job) return { success: false, error: "Job not found" };
  if (!job.invoice) return { success: false, error: "Generate the invoice first, then the delivery note." };

  const deliveredByName = user.name?.trim() || "Front desk";
  // The job knows who collected the device; the generic paths cannot.
  const receivedByName = job.deliveredTo?.trim() || job.client.fullName;

  try {
    const result = await createDeliveryNoteFromInvoice({
      orgId,
      invoiceId: job.invoice.id,
      actorUserId: user.id,
      deliveredByName,
      receivedByName,
      deliveryMethod: job.deliveryMethod,
    });
    if (!result.ok) return { success: false, error: result.error };

    // Idempotent on purpose: an invoice that already has a note returns that
    // note's number rather than a second document, so a double-tap is safe.
    if (!result.duplicate) {
      revalidatePath(`/jobs/${jobId}`);
      revalidatePath("/documents/delivery-notes");
    }
    return { success: true, deliveryNoteNumber: result.deliveryNoteNumber };
  } catch {
    return { success: false, error: "Could not create the delivery note. Please try again." };
  }
}

export async function sendInvoiceViaWhatsAppAction(
  jobId: string,
): Promise<{ success: boolean; error?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS"].includes(user.role) && !can.approveInvoices({ role: user.role, permissions: user.permissions })) {
    return { success: false, error: "Not authorised" };
  }
  const result = await generateInvoiceBuffer(jobId, user.name, user.role, user.id, orgId);
  if (!result.ok) return { success: false, error: result.error };
  return sendPdfViaWhatsApp({
    jobId, userId: user.id, orgId,
    filename: result.filename, clientPhone: result.clientPhone,
    caption: `Please find your invoice (${result.invoiceNumber}) attached.`,
    outboxBody: `[Invoice PDF] ${result.invoiceNumber}`,
    documentKind: "invoice",
    staffName: user.name,
    staffRole: user.role,
    auditAction: "INVOICE_SENT_WHATSAPP",
    auditDetail: { invoiceNumber: result.invoiceNumber },
  });
}

export async function sendJobCardViaWhatsAppAction(
  jobId: string,
): Promise<{ success: boolean; error?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS"].includes(user.role) && !can.generateJobCards({ role: user.role, permissions: user.permissions })) {
    return { success: false, error: "Not authorised" };
  }
  const result = await generateJobCardBuffer(jobId, user.name, user.role, user.id, orgId);
  if (!result.ok) return { success: false, error: result.error };
  return sendPdfViaWhatsApp({
    jobId, userId: user.id, orgId,
    filename: result.filename, clientPhone: result.clientPhone,
    caption: `Please find your job card (${result.documentNumber}) attached.`,
    outboxBody: `[Job Card PDF] ${result.documentNumber}`,
    documentKind: "job_card",
    staffName: user.name,
    staffRole: user.role,
    auditAction: "JOB_CARD_SENT_WHATSAPP",
    auditDetail: { documentNumber: result.documentNumber },
  });
}

export async function sendAssessmentViaWhatsAppAction(
  jobId: string,
): Promise<{ success: boolean; error?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS", "FRONT_DESK"].includes(user.role)) {
    return { success: false, error: "Not authorised" };
  }
  // Only a published (client-visible) report may be sent to the customer.
  const result = await generateAssessmentBuffer({ orgId, jobId, requireClientVisible: true });
  if (!result.ok) return { success: false, error: result.error };

  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: { jobNumber: true, client: { select: { phone: true } } },
  });
  const clientPhone = job?.client?.phone ?? "";
  if (!clientPhone) return { success: false, error: "This client has no phone number on file." };

  return sendPdfViaWhatsApp({
    jobId, userId: user.id, orgId,
    filename: result.filename, clientPhone,
    caption: `Please find your assessment report (${job?.jobNumber ?? ""}) attached.`,
    outboxBody: `[Assessment PDF] ${job?.jobNumber ?? jobId}`,
    documentKind: "assessment",
    staffName: user.name,
    staffRole: user.role,
    auditAction: "ASSESSMENT_SENT_WHATSAPP",
    auditDetail: { jobNumber: job?.jobNumber ?? "" },
  });
}

// ── Email counterparts: the PDF is attached to the email (Resend) ──

export async function sendQuotationViaEmailAction(
  jobId: string,
): Promise<{ success: boolean; error?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS", "FRONT_DESK"].includes(user.role)) {
    return { success: false, error: "Not authorised" };
  }
  const result = await generateQuotationBuffer(jobId, user.name, user.role, true, user.id, orgId);
  if (!result.ok) return { success: false, error: result.error };
  const clientEmail = await jobClientEmail(jobId, orgId);
  if (!clientEmail) return { success: false, error: "This client has no email address on file." };
  return sendPdfViaEmail({
    jobId, userId: user.id, orgId,
    filename: result.filename, clientEmail,
    subject: `Quotation ${result.quotationNumber}`,
    emailBody: `Please find your quotation (${result.quotationNumber}) attached.`,
    documentKind: "quotation",
    stampQuotedAt: true,
    staffName: user.name,
    staffRole: user.role,
    auditAction: "QUOTATION_SENT_EMAIL",
    auditDetail: { quotationNumber: result.quotationNumber },
  });
}

export async function sendInvoiceViaEmailAction(
  jobId: string,
): Promise<{ success: boolean; error?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS"].includes(user.role) && !can.approveInvoices({ role: user.role, permissions: user.permissions })) {
    return { success: false, error: "Not authorised" };
  }
  const result = await generateInvoiceBuffer(jobId, user.name, user.role, user.id, orgId);
  if (!result.ok) return { success: false, error: result.error };
  const clientEmail = await jobClientEmail(jobId, orgId);
  if (!clientEmail) return { success: false, error: "This client has no email address on file." };
  return sendPdfViaEmail({
    jobId, userId: user.id, orgId,
    filename: result.filename, clientEmail,
    subject: `Invoice ${result.invoiceNumber}`,
    emailBody: `Please find your invoice (${result.invoiceNumber}) attached.`,
    documentKind: "invoice",
    staffName: user.name,
    staffRole: user.role,
    auditAction: "INVOICE_SENT_EMAIL",
    auditDetail: { invoiceNumber: result.invoiceNumber },
  });
}

export async function sendJobCardViaEmailAction(
  jobId: string,
): Promise<{ success: boolean; error?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS"].includes(user.role) && !can.generateJobCards({ role: user.role, permissions: user.permissions })) {
    return { success: false, error: "Not authorised" };
  }
  const result = await generateJobCardBuffer(jobId, user.name, user.role, user.id, orgId);
  if (!result.ok) return { success: false, error: result.error };
  const clientEmail = await jobClientEmail(jobId, orgId);
  if (!clientEmail) return { success: false, error: "This client has no email address on file." };
  return sendPdfViaEmail({
    jobId, userId: user.id, orgId,
    filename: result.filename, clientEmail,
    subject: `Job card ${result.documentNumber}`,
    emailBody: `Please find your job card (${result.documentNumber}) attached.`,
    documentKind: "job_card",
    staffName: user.name,
    staffRole: user.role,
    auditAction: "JOB_CARD_SENT_EMAIL",
    auditDetail: { documentNumber: result.documentNumber },
  });
}

export async function sendAssessmentViaEmailAction(
  jobId: string,
): Promise<{ success: boolean; error?: string }> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!["ADMIN", "OPS", "FRONT_DESK"].includes(user.role)) {
    return { success: false, error: "Not authorised" };
  }
  const result = await generateAssessmentBuffer({ orgId, jobId, requireClientVisible: true });
  if (!result.ok) return { success: false, error: result.error };
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: { jobNumber: true, client: { select: { email: true } } },
  });
  const clientEmail = job?.client?.email ?? "";
  if (!clientEmail) return { success: false, error: "This client has no email address on file." };
  return sendPdfViaEmail({
    jobId, userId: user.id, orgId,
    filename: result.filename, clientEmail,
    subject: `Assessment report ${job?.jobNumber ?? ""}`,
    emailBody: `Please find your assessment report (${job?.jobNumber ?? ""}) attached.`,
    documentKind: "assessment",
    staffName: user.name,
    staffRole: user.role,
    auditAction: "ASSESSMENT_SENT_EMAIL",
    auditDetail: { jobNumber: job?.jobNumber ?? "" },
  });
}
