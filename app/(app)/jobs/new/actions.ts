"use server";

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

const newJobSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(3),
  email: z.string().email().optional().or(z.literal("")),
  organization: z.string().optional(),
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
  receivedAt: z.string().optional(),
});

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
    return { error: "You cannot create jobs." };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = newJobSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form values" };
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

  let job: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const jobNumber = await generateJobNumber();
    try {
      job = await prisma.job.create({
        data: {
          jobNumber,
          clientId: client.id,
          createdById: session.user.id,
          deviceType: parsed.data.deviceType,
          brand: sanitizeText(parsed.data.brand),
          model: sanitizeText(parsed.data.model),
          serialOrImei: sanitizeOptionalText(parsed.data.serialOrImei),
          accessories: sanitizeOptionalText(parsed.data.accessories),
          physicalNotes: sanitizeOptionalText(parsed.data.physicalNotes),
          issueDescription: sanitizeText(parsed.data.issueDescription),
          receivedAt: parsed.data.receivedAt
            ? new Date(parsed.data.receivedAt)
            : new Date(),
        },
        select: { id: true },
      });
      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  if (!job) {
    return { error: "Could not allocate unique job number. Please retry." };
  }

  await prisma.auditLog.create({
    data: {
      jobId: job.id,
      userId: session.user.id,
      action: "JOB_CREATED",
      detail: JSON.stringify({
        status: "RECEIVED",
      }),
    },
  });

  const files = formData.getAll("photos") as File[];
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  const maxSize = 5 * 1024 * 1024;

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

  return { success: true, id: job.id };
}
