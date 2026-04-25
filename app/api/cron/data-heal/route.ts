import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function cleanText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

export async function POST(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const secret = process.env.CRON_SECRET;
  const provided = request.nextUrl.searchParams.get("secret");
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";

  if (!isVercelCron && (!secret || provided !== secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const candidates = await prisma.job.findMany({
    where: {
      OR: [{ brand: "Unknown" }, { model: "Unknown" }, { deviceType: "OTHER" }],
    },
    include: {
      device: {
        select: {
          brand: true,
          model: true,
          deviceType: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, dryRun, checked: 0, fixed: 0, pending: 0, changes: [] });
  }

  const jobIds = candidates.map((job) => job.id);
  const linkedRequests = await prisma.repairRequest.findMany({
    where: { linkedJobId: { in: jobIds } },
    select: {
      linkedJobId: true,
      brand: true,
      model: true,
      deviceType: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const requestByJobId = new Map<string, (typeof linkedRequests)[number]>();
  for (const req of linkedRequests) {
    if (!req.linkedJobId) continue;
    if (!requestByJobId.has(req.linkedJobId)) {
      requestByJobId.set(req.linkedJobId, req);
    }
  }

  const actor = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  const changes: Array<{
    id: string;
    jobNumber: string;
    from: { brand: string; model: string; deviceType: string };
    to: { brand: string; model: string; deviceType: string };
  }> = [];

  for (const job of candidates) {
    const req = requestByJobId.get(job.id);
    const deviceBrand = cleanText(job.device?.brand);
    const reqBrand = cleanText(req?.brand);
    const deviceModel = cleanText(job.device?.model);
    const reqModel = cleanText(req?.model);
    const deviceType = job.device?.deviceType;
    const reqType = req?.deviceType;

    const nextBrand =
      job.brand === "Unknown"
        ? deviceBrand ?? reqBrand ?? job.brand
        : job.brand;

    const nextModel =
      job.model === "Unknown"
        ? deviceModel ?? reqModel ?? job.model
        : job.model;

    const nextDeviceType =
      job.deviceType === "OTHER"
        ? (deviceType && deviceType !== "OTHER" ? deviceType : reqType && reqType !== "OTHER" ? reqType : job.deviceType)
        : job.deviceType;

    const changed =
      nextBrand !== job.brand ||
      nextModel !== job.model ||
      nextDeviceType !== job.deviceType;

    if (!changed) continue;

    changes.push({
      id: job.id,
      jobNumber: job.jobNumber,
      from: { brand: job.brand, model: job.model, deviceType: job.deviceType },
      to: { brand: nextBrand, model: nextModel, deviceType: nextDeviceType },
    });

    if (dryRun) continue;

    await prisma.job.update({
      where: { id: job.id },
      data: {
        brand: nextBrand,
        model: nextModel,
        deviceType: nextDeviceType,
      },
    });

    if (actor?.id) {
      await prisma.auditLog.create({
        data: {
          jobId: job.id,
          userId: actor.id,
          action: "DATA_HEAL_JOB_DEVICE_FIELDS",
          detail: JSON.stringify({
            from: { brand: job.brand, model: job.model, deviceType: job.deviceType },
            to: { brand: nextBrand, model: nextModel, deviceType: nextDeviceType },
            source: "cron:data-heal",
          }),
        },
      });
    }
  }

  const pending = await prisma.job.count({
    where: {
      OR: [{ brand: "Unknown" }, { model: "Unknown" }, { deviceType: "OTHER" }],
    },
  });

  return NextResponse.json({
    ok: true,
    dryRun,
    checked: candidates.length,
    fixed: changes.length,
    pending,
    changes: changes.slice(0, 50),
  });
}
