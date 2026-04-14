"use server";

import { Prisma, RepairRequestStatus, Role, DeviceType, HandoverMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getCurrentUserRole } from "@/lib/session";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { generateJobNumber } from "@/app/(app)/jobs/new/actions";
import {
  sendIntakeApprovalNotification,
  sendIntakeRejectionNotification,
  sendJobCreatedNotification,
} from "@/lib/notifications/whatsapp";

const listSchema = z.object({
  take: z.coerce.number().int().positive().max(500).optional(),
});

export async function listRepairRequestsAction(input?: { take?: number }) {
  const { user } = await getCurrentUserRole();
  if (!can.viewIntake(user)) return { error: "Forbidden" } as const;

  const parsed = listSchema.safeParse(input ?? {});
  const take = parsed.success ? parsed.data.take ?? 200 : 200;

  const requests = await prisma.repairRequest.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });

  return { success: true as const, requests };
}

export async function readRepairRequestAction(id: string) {
  const { user } = await getCurrentUserRole();
  if (!can.viewIntake(user)) return { error: "Forbidden" } as const;

  const req = await prisma.repairRequest.findUnique({ where: { id } });
  if (!req) return { error: "Not found" } as const;
  return { success: true as const, request: req };
}

const updateDetailsSchema = z.object({
  id: z.string().min(1),
  customerName: z.string().min(1).max(200).optional(),
  phone: z.string().min(5).max(32).optional(),
  email: z.string().email().optional().or(z.literal("")),
  deviceType: z.nativeEnum(DeviceType).optional(),
  brand: z.string().min(1).max(120).optional(),
  model: z.string().max(120).optional().or(z.literal("")),
  serialNumber: z.string().max(120).optional().or(z.literal("")),
  handoverMethod: z.nativeEnum(HandoverMethod).optional(),
  problemDescription: z.string().min(1).max(5000).optional(),
});

export async function updateRepairRequestDetailsAction(formData: FormData) {
  const { user } = await getCurrentUserRole();
  if (!can.manageIntake(user)) return { error: "Forbidden" } as const;

  const payload = updateDetailsSchema.safeParse({
    id: formData.get("id"),
    customerName: formData.get("customerName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    deviceType: formData.get("deviceType"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    serialNumber: formData.get("serialNumber"),
    handoverMethod: formData.get("handoverMethod"),
    problemDescription: formData.get("problemDescription"),
  });

  if (!payload.success) {
    return { error: "Invalid input" } as const;
  }

  const data: Prisma.RepairRequestUpdateInput = {};
  if (payload.data.customerName !== undefined) data.customerName = sanitizeText(payload.data.customerName);
  if (payload.data.phone !== undefined) data.phone = sanitizeText(payload.data.phone);
  if (payload.data.email !== undefined) data.email = sanitizeOptionalText(payload.data.email) || null;
  if (payload.data.deviceType !== undefined) data.deviceType = payload.data.deviceType;
  if (payload.data.brand !== undefined) data.brand = sanitizeText(payload.data.brand);
  if (payload.data.model !== undefined) data.model = sanitizeOptionalText(payload.data.model) || null;
  if (payload.data.serialNumber !== undefined) data.serialNumber = sanitizeOptionalText(payload.data.serialNumber) || null;
  if (payload.data.handoverMethod !== undefined) data.handoverMethod = payload.data.handoverMethod;
  if (payload.data.problemDescription !== undefined) data.problemDescription = sanitizeText(payload.data.problemDescription);

  const updated = await prisma.repairRequest.update({
    where: { id: payload.data.id },
    data,
  });

  revalidatePath("/intake");
  return { success: true as const, request: updated };
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(RepairRequestStatus),
});

export async function setRepairRequestStatusAction(input: { id: string; status: RepairRequestStatus }) {
  const { session, user } = await getCurrentUserRole();
  if (!can.manageIntake(user)) return { error: "Forbidden" } as const;

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid status" } as const;

  const req = await prisma.repairRequest.findUnique({ where: { id: parsed.data.id } });
  if (!req) return { error: "Request not found" } as const;

  // Convert to Job
  if (parsed.data.status === "CONVERTED_TO_JOB") {
    const client = await prisma.client.upsert({
      where: { phone: req.phone },
      create: {
        fullName: sanitizeText(req.customerName),
        phone: req.phone,
        email: sanitizeOptionalText(req.email) ?? undefined,
      },
      update: {
        fullName: sanitizeText(req.customerName),
        email: sanitizeOptionalText(req.email) ?? undefined,
      },
    });

    let job: { id: string; jobNumber: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const jobNumber = await generateJobNumber();
      try {
        job = await prisma.job.create({
          data: {
            jobNumber,
            clientId: client.id,
            createdById: session.user.id,
            deviceType: req.deviceType,
            brand: sanitizeText(req.brand),
            model: sanitizeText(req.model ?? ""),
            serialOrImei: sanitizeOptionalText(req.serialNumber) ?? undefined,
            issueDescription: sanitizeText(req.problemDescription),
          },
          select: { id: true, jobNumber: true },
        });
        break;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throw err;
      }
    }

    if (!job) return { error: "Could not allocate job number. Please retry." } as const;

    await prisma.auditLog.create({
      data: {
        jobId: job.id,
        userId: session.user.id,
        action: "JOB_CREATED",
        detail: JSON.stringify({ status: "RECEIVED", sourceRequest: req.requestNumber }),
      },
    });

    await prisma.repairRequest.update({
      where: { id: req.id },
      data: { requestStatus: "CONVERTED_TO_JOB", linkedJobId: job.id },
    });

    // Non-blocking WhatsApp
    sendJobCreatedNotification(req.phone, req.customerName, job.jobNumber).catch((err) =>
      console.error("[Intake] WhatsApp notification failed:", err),
    );

    revalidatePath("/intake");
    return {
      success: true as const,
      requestStatus: "CONVERTED_TO_JOB" as const,
      jobId: job.id,
      jobNumber: job.jobNumber,
    };
  }

  // Approve / Reject / Pending
  const updated = await prisma.repairRequest.update({
    where: { id: req.id },
    data: { requestStatus: parsed.data.status },
  });

  if (parsed.data.status === "APPROVED") {
    sendIntakeApprovalNotification(
      updated.phone,
      updated.customerName,
      updated.requestNumber,
      updated.preferredDropoffDate,
    ).catch((err) => console.error("[Intake] WhatsApp notification failed:", err));
  }

  if (parsed.data.status === "REJECTED") {
    sendIntakeRejectionNotification(updated.phone, updated.customerName, updated.requestNumber).catch((err) =>
      console.error("[Intake] WhatsApp notification failed:", err),
    );
  }

  revalidatePath("/intake");
  return { success: true as const, requestStatus: updated.requestStatus };
}

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function deleteRepairRequestAction(formData: FormData) {
  const { user } = await getCurrentUserRole();
  if (user.role !== Role.ADMIN) return { error: "Forbidden" } as const;

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request" } as const;

  const existing = await prisma.repairRequest.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { success: true as const };

  if (existing.requestStatus === "CONVERTED_TO_JOB") {
    return { error: "Cannot delete: request is already converted to a job." } as const;
  }

  await prisma.repairRequest.delete({ where: { id: parsed.data.id } });
  revalidatePath("/intake");
  return { success: true as const };
}
