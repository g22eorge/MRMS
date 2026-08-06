"use server";

import { redirect } from "next/navigation";
import { JobStatus, Prisma, type SoftwareInstallerSource } from "@prisma/client";
import { z } from "zod";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOrgNumberConfig, maxSequenceForYear, composeJobNumber } from "@/lib/commercial/org-number";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { uploadJobImage } from "@/lib/blob-storage";
import { checkJobLimit } from "@/lib/plan-limits";
import { rateLimit } from "@/lib/rate-limit";
import { notifyJobCreated } from "@/lib/notifications";

const deviceSchema = z
  .object({
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
  serviceType: z.enum(["HARDWARE", "SOFTWARE", "BOTH"]).optional(),
  softwareOsInstall: z.boolean().optional(),
  softwareDriversUpdates: z.boolean().optional(),
  softwareDataBackupRestore: z.boolean().optional(),
  softwareAccountSetup: z.boolean().optional(),
  softwarePerformanceTune: z.boolean().optional(),
  softwareThirdPartyApps: z.boolean().optional(),
  softwareRequestedNotes: z.string().optional(),
  softwareLicenseAttested: z.boolean().optional(),
  softwareInstallerSource: z
    .enum([
      "CLIENT_PROVIDED_INSTALLER",
      "CLIENT_ACCOUNT_LOGIN",
      "COMPANY_LICENSE",
      "OPEN_SOURCE",
      "OTHER",
    ])
    .optional()
    .or(z.literal("")),
  softwareInstallerSourceNote: z.string().optional(),
  issueDescription: z.string().min(5),
  })
  .superRefine((value, ctx) => {
    const serviceType = value.serviceType ?? "HARDWARE";
    if (serviceType !== "HARDWARE" && !value.softwareLicenseAttested) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Software jobs require license attestation.",
        path: ["softwareLicenseAttested"],
      });
    }
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
    return { ok: false as const, error: "Invalid devices payload" };
  }

  const parsed = z.array(deviceSchema).min(1).max(10).safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid device details" };
  }
  return { ok: true as const, devices: parsed.data };
}

export async function generateJobNumber(orgId?: string) {
  const year = new Date().getFullYear();
  const { prefix, pad } = await getOrgNumberConfig(orgId);

  // Two scans, run together:
  //  - global scan of this prefix/year keeps the globally-@unique jobNumber
  //    collision-free across tenants sharing a prefix;
  //  - per-org scan of any this-year number (new slash form or legacy hyphen
  //    form) continues the org's sequence instead of restarting at 0001.
  const [globalRows, orgRows] = await Promise.all([
    prisma.job.findMany({
      where: { jobNumber: { startsWith: `${prefix}/${year}/` } },
      select: { jobNumber: true },
    }),
    orgId
      ? prisma.job.findMany({
          where: {
            orgId,
            OR: [
              { jobNumber: { contains: `/${year}/` } },
              { jobNumber: { contains: `-${year}-` } },
            ],
          },
          select: { jobNumber: true },
        })
      : Promise.resolve([] as { jobNumber: string }[]),
  ]);

  const globalMax = maxSequenceForYear(globalRows.map((r) => r.jobNumber), year);
  const orgMax = maxSequenceForYear(orgRows.map((r) => r.jobNumber), year);
  const next = Math.max(globalMax, orgMax) + 1;
  return composeJobNumber(prefix, year, next, pad);
}

export async function createJobAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  try {
    const { session, user, orgId, org } = await requireOrgSession();

    // Billing enforcement: suspended orgs are read-only.
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    if (!can.createJob(user)) {
      return { error: "You cannot create jobs." };
    }

    const rl = await rateLimit.jobCreate(orgId);
    if (!rl.allowed) {
      return { error: "Too many jobs created in a short period. Please wait a moment and try again." };
    }

    const jobLimit = await checkJobLimit(orgId);
    if (!jobLimit.allowed) {
      return { error: jobLimit.reason };
    }

    const raw = Object.fromEntries(formData.entries());
    const parsed = newJobSchema.safeParse(raw);

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid form values" };
    }

    const client = await prisma.client.upsert({
      where: { phone_orgId: { orgId, phone: sanitizeText(parsed.data.phone) } },
      create: {
        orgId,
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

    const parsedDevices = parseDevices(parsed.data.devicesJson);
    if (!parsedDevices.ok) {
      return { error: parsedDevices.error };
    }
    const devices = parsedDevices.devices;
    const receivedAt = parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date();

    const openStatuses = filterSupportedJobStatuses([
      "RECEIVED",
      "DIAGNOSING",
      "REFERRED",
      "IN_EXTERNAL_REPAIR",
      "WAITING_FOR_PARTS",
      "RETURNED_FROM_EXTERNAL",
      "AWAITING_APPROVAL",
      "IN_REPAIR",
      "READY_FOR_PICKUP",
    ]) as JobStatus[];

    const createdJobs: Array<{ id: string; jobNumber: string }> = [];

    for (let i = 0; i < devices.length; i += 1) {
      const device = devices[i];
      const serial = sanitizeOptionalText(device.serialOrImei);
      if (serial) {
        const dup = await prisma.job.findFirst({
          where: {
            orgId,
            clientId: client.id,
            serialOrImei: serial,
            status: { in: openStatuses },
          },
          select: { id: true, jobNumber: true },
        });
        if (dup) {
          return { error: `An open job already exists for this device serial/IMEI: ${dup.jobNumber}` };
        }
      }

    // Device info is written to both the Device relation and denormalized Job fields.
    // Device relation is the canonical source when deviceId is set; denormalized fields
    // are kept in sync as a fallback for environments where the Device table is absent.
    let deviceId: string | null = null;
    try {
      // Reuse the existing Device for a returning unit (same org + serial/IMEI) so
      // repair history accumulates on one record instead of spawning a new Device
      // every visit. Only dedup when a serial/IMEI was actually captured.
      const existingDevice = serial
        ? await prisma.device.findFirst({ where: { orgId, serialOrImei: serial }, select: { id: true } })
        : null;
      const deviceData = {
        clientId: client.id,
        deviceType: device.deviceType,
        brand: sanitizeText(device.brand),
        model: sanitizeText(device.model),
        accessories: sanitizeOptionalText(device.accessories),
        physicalNotes: sanitizeOptionalText(device.physicalNotes),
      };
      if (existingDevice) {
        await prisma.device.update({ where: { id: existingDevice.id }, data: deviceData });
        deviceId = existingDevice.id;
      } else {
        const createdDevice = await prisma.device.create({
          data: { orgId, serialOrImei: serial, ...deviceData },
          select: { id: true },
        });
        deviceId = createdDevice.id;
      }
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

    let job: { id: string; jobNumber: string } | null = null;
    let includeSoftwareFields = true;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const jobNumber = await generateJobNumber(orgId);
      try {
        const serviceType = device.serviceType ?? "HARDWARE";
        const softwareRequestedNotes = sanitizeOptionalText(device.softwareRequestedNotes);
        const softwareInstallerSourceNote = sanitizeOptionalText(device.softwareInstallerSourceNote);

        const rawInstallerSource = (device as { softwareInstallerSource?: unknown }).softwareInstallerSource;
        const allowedInstallerSources = new Set<SoftwareInstallerSource>([
          "CLIENT_PROVIDED_INSTALLER",
          "CLIENT_ACCOUNT_LOGIN",
          "COMPANY_LICENSE",
          "OPEN_SOURCE",
          "OTHER",
        ]);
        const normalizedInstallerSource =
          typeof rawInstallerSource === "string" && allowedInstallerSources.has(rawInstallerSource as SoftwareInstallerSource)
            ? (rawInstallerSource as SoftwareInstallerSource)
            : undefined;

        const softwareFields = {
          serviceType,
          softwareOsInstall: Boolean(device.softwareOsInstall),
          softwareDriversUpdates: Boolean(device.softwareDriversUpdates),
          softwareDataBackupRestore: Boolean(device.softwareDataBackupRestore),
          softwareAccountSetup: Boolean(device.softwareAccountSetup),
          softwarePerformanceTune: Boolean(device.softwarePerformanceTune),
          softwareThirdPartyApps: Boolean(device.softwareThirdPartyApps),
          softwareRequestedNotes,
          softwareLicenseAttested: Boolean(device.softwareLicenseAttested),
          softwareInstallerSource: normalizedInstallerSource,
          softwareInstallerSourceNote,
        } as const;

        job = await prisma.job.create({
          data: {
            orgId,
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
            ...(includeSoftwareFields && serviceType !== "HARDWARE" ? { repairPath: "IN_HOUSE" } : {}),
            ...(includeSoftwareFields ? softwareFields : {}),
            receivedAt,
          },
          select: { id: true, jobNumber: true },
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") {
            continue;
          }
          // deviceId column missing in some environments
          if (error.code === "P2022") {
            // serviceType/software columns may not be migrated yet.
            // Drop them and retry.
            const message = error.message || "";
            if (
              message.includes("serviceType") ||
              message.includes("softwareOsInstall") ||
              message.includes("softwareDriversUpdates") ||
              message.includes("softwareDataBackupRestore") ||
              message.includes("softwareAccountSetup") ||
              message.includes("softwarePerformanceTune") ||
              message.includes("softwareThirdPartyApps") ||
              message.includes("softwareRequestedNotes") ||
              message.includes("softwareLicenseAttested") ||
              message.includes("softwareInstallerSource") ||
              message.includes("softwareInstallerSourceNote")
            ) {
              includeSoftwareFields = false;
              continue;
            }
            deviceId = null;
            continue;
          }
        }
        throw error;
      }
    }

      if (!job) {
        return { error: "Could not allocate unique job number. Please retry." };
      }

    createdJobs.push(job);

    await prisma.auditLog.create({
      data: {
        orgId,
        jobId: job.id,
        userId: session.user.id,
        action: "JOB_CREATED",
        detail: JSON.stringify({ status: "RECEIVED" }),
      },
    });

      // Intake "before" photos → Vercel Blob (persistent). Default INTERNAL;
      // staff can mark them client-visible later from the job's Photos tab.
      const files = formData.getAll(`photos_${i}`) as File[];
      for (const file of files) {
        if (!file?.size) continue;
        const up = await uploadJobImage(job.id, file);
        if (!up.ok) continue; // skip invalid/oversized (or unconfigured storage)
        await prisma.photo.create({
          data: {
            jobId: job.id,
            orgId,
            label: "before",
            visibility: "INTERNAL",
            url: up.image.url,
            storageKey: up.image.key,
            mimeType: up.image.mimeType,
          },
        });
      }
    }

    const parsedDevicesForNotify = parseDevices(parsed.data.devicesJson);
    const firstDevice = parsedDevicesForNotify.ok ? parsedDevicesForNotify.devices[0] : null;
    for (const j of createdJobs) {
      notifyJobCreated({
        orgId,
        jobNumber: j.jobNumber,
        clientName: parsed.data.fullName ?? "Client",
        deviceLabel: firstDevice ? `${firstDevice.brand} ${firstDevice.model ?? ""}`.trim() : "Device",
        actorName: user.name ?? user.email ?? "Unknown",
      }).catch(() => {});
    }
    redirect(createdJobs.length === 1 ? `/jobs/${createdJobs[0]!.id}` : "/jobs");
  } catch (err) {
    // Preserve Next redirect behavior
    const digest =
      err && typeof err === "object" && "digest" in err
        ? String((err as { digest?: unknown }).digest)
        : "";
    if (digest.includes("NEXT_REDIRECT")) throw err;

    const msg = err instanceof Error ? err.message : "Failed to create job";
    console.error("[createJobAction]", msg);
    return { error: msg };
  }
}
