"use server";

import { redirect } from "next/navigation";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { getCurrentUserRole } from "@/lib/session";
import { getUploadsRoot } from "@/lib/storage";

const deviceSchema = z.object({
  deviceType: z.enum([
    "PHONE_ANDROID",
    "PHONE_IPHONE",
    "TABLET",
    "WINDOWS_PC",
    "MAC",
    "OTHER",
  ]),
  brand: z.string().min(1),
  model: z.string().min(1),
  serialOrImei: z.string().optional(),
  accessories: z.string().optional(),
  physicalNotes: z.string().optional(),
  issueDescription: z.string().min(5),
});

const newJobSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(3),
  email: z.string().email().optional().or(z.literal("")),
  organization: z.string().optional(),
  devicesJson: z.string().min(2),
  receivedAt: z.string().optional(),
});

function parseDevices(devicesJson: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(devicesJson);
  } catch {
    throw new Error("Invalid devices payload");
  }

  const parsed = z.array(deviceSchema).min(1).max(10).safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid device details");
  }
  return parsed.data;
}

export async function generateJobNumber() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const prefix = `EIS-${month}/${year}/`;
  const latest = await prisma.job.findFirst({
    where: { jobNumber: { startsWith: prefix } },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });

  const latestSeq = latest?.jobNumber.slice(prefix.length) ?? "0";
  const numeric = Number(latestSeq);
  const next = Number.isFinite(numeric) ? numeric + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function createJobAction(formData: FormData) {
  const { session, user } = await getCurrentUserRole();

  if (!can.createJob(user)) {
    throw new Error("You cannot create jobs.");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = newJobSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid form values");
  }

  const client = await prisma.client.upsert({
    where: { phone: parsed.data.phone },
    create: {
      fullName: sanitizeText(parsed.data.fullName),
      phone: sanitizeText(parsed.data.phone),
      email: sanitizeOptionalText(parsed.data.email),
      organization: sanitizeOptionalText(parsed.data.organization),
    },
    update: {
      fullName: sanitizeText(parsed.data.fullName),
      email: sanitizeOptionalText(parsed.data.email),
      organization: sanitizeOptionalText(parsed.data.organization),
    },
  });

  const devices = parseDevices(parsed.data.devicesJson);
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  const maxSize = 5 * 1024 * 1024;
  const receivedAt = parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date();

  const openStatuses = [
    "RECEIVED",
    "DIAGNOSING",
    "AWAITING_APPROVAL",
    "IN_REPAIR",
    "READY_FOR_PICKUP",
    "DELIVERED",
  ] as const;

  const createdJobs: Array<{ id: string }> = [];

  for (let i = 0; i < devices.length; i += 1) {
    const device = devices[i];
    const serial = sanitizeOptionalText(device.serialOrImei);
    if (serial) {
      const dup = await prisma.job.findFirst({
        where: {
          clientId: client.id,
          serialOrImei: serial,
          status: { in: [...openStatuses] },
        },
        select: { id: true, jobNumber: true },
      });
      if (dup) {
        throw new Error(`An open job already exists for this device serial/IMEI: ${dup.jobNumber}`);
      }
    }

    let deviceId: string | null = null;
    try {
      const createdDevice = await prisma.device.create({
        data: {
          clientId: client.id,
          deviceType: device.deviceType,
          brand: sanitizeText(device.brand),
          model: sanitizeText(device.model),
          serialOrImei: serial,
          accessories: sanitizeOptionalText(device.accessories),
          physicalNotes: sanitizeOptionalText(device.physicalNotes),
        },
        select: { id: true },
      });
      deviceId = createdDevice.id;
    } catch (error) {
      // If Device table isn't migrated in a given environment, fall back to legacy Job-only storage.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2021" || error.code === "P2022")
      ) {
        deviceId = null;
      } else {
        throw error;
      }
    }

    let job: { id: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const jobNumber = await generateJobNumber();
      try {
        job = await prisma.job.create({
          data: {
            jobNumber,
            clientId: client.id,
            createdById: session.user.id,
            ...(deviceId ? { deviceId } : {}),
            deviceType: device.deviceType,
            brand: sanitizeText(device.brand),
            model: sanitizeText(device.model),
            serialOrImei: serial,
            accessories: sanitizeOptionalText(device.accessories),
            physicalNotes: sanitizeOptionalText(device.physicalNotes),
            issueDescription: sanitizeText(device.issueDescription),
            receivedAt,
          },
          select: { id: true },
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") {
            continue;
          }
          // deviceId column missing in some environments
          if (error.code === "P2022") {
            deviceId = null;
            continue;
          }
        }
        throw error;
      }
    }

    if (!job) {
      throw new Error("Could not allocate unique job number. Please retry.");
    }

    createdJobs.push(job);

    await prisma.auditLog.create({
      data: {
        jobId: job.id,
        userId: session.user.id,
        action: "JOB_CREATED",
        detail: JSON.stringify({ status: "RECEIVED" }),
      },
    });

    const files = formData.getAll(`photos_${i}`) as File[];
    if (files.length > 0) {
      const uploadDir = path.join(getUploadsRoot(), "jobs", job.id);
      await mkdir(uploadDir, { recursive: true });

      for (const file of files) {
        if (!file?.size) continue;
        if (!allowed.has(file.type) || file.size > maxSize) {
          continue;
        }
        const ext = file.type.split("/")[1] || "jpg";
        const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
        const absPath = path.join(uploadDir, fileName);
        await writeFile(absPath, Buffer.from(await file.arrayBuffer()));
        await prisma.photo.create({
          data: {
            jobId: job.id,
            label: "before",
            url: `/api/uploads/jobs/${job.id}/${fileName}`,
          },
        });
      }
    }
  }

  redirect(createdJobs.length === 1 ? `/jobs/${createdJobs[0]!.id}` : "/jobs");
}
