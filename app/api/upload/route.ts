// @ts-nocheck
import { unlink } from "fs/promises";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { getUploadsRoot } from "@/lib/storage";
import { uploadJobImage, deleteBlobObject } from "@/lib/blob-storage";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";

const ALLOWED_LABELS = new Set(["before", "during", "after", "other"]);

export async function POST(req: NextRequest) {
  const { session, user, orgId, org } = await requireOrgSession();
  try {
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace is read-only.";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  // Per-user upload rate limit (30 uploads / 10 min).
  const rl = await rateLimit.upload(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment." },
      { status: 429, headers: rateLimitHeaders(rl.retryAfterMs) },
    );
  }

  const formData = await req.formData();
  const jobId = String(formData.get("jobId") ?? "");
  const rawLabel = sanitizeText(String(formData.get("label") ?? "other")).toLowerCase();
  const label = ALLOWED_LABELS.has(rawLabel) ? rawLabel : "other";
  const files = formData.getAll("files") as File[];

  if (!jobId || files.length === 0) {
    return NextResponse.json({ error: "Invalid upload payload" }, { status: 400 });
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: { id: true, assignedToId: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const roleAllowed = [
    "ADMIN",
    "OPS",
    "TECHNICIAN_INTERNAL",
    "TECHNICIAN_EXTERNAL",
  ].includes(user.role);
  if (!roleAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    (user.role === "TECHNICIAN_INTERNAL" || user.role === "TECHNICIAN_EXTERNAL") &&
    job.assignedToId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Client portal: an upload flagged "CLIENT" is shown to the customer; default
  // INTERNAL (staff-only). Validation + storage handled by the Blob helper.
  const visibility = String(formData.get("visibility") ?? "INTERNAL").toUpperCase() === "CLIENT" ? "CLIENT" : "INTERNAL";

  const created = [];
  for (const file of files) {
    const up = await uploadJobImage(jobId, file);
    if (!up.ok) {
      return NextResponse.json({ error: up.error }, { status: 400 });
    }
    const photo = await prisma.photo.create({
      data: {
        jobId,
        orgId,
        url: up.image.url,
        label,
        visibility,
        storageKey: up.image.key,
        mimeType: up.image.mimeType,
        uploadedById: session.user.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        orgId,
        jobId,
        userId: session.user.id,
        action: "PHOTO_UPLOADED",
        detail: JSON.stringify({ photoId: photo.id, label, visibility }),
      },
    }).catch((err) => console.error("[upload] audit log (PHOTO_UPLOADED) failed:", err));
    created.push(photo);
  }

  return NextResponse.json(created);
}

/** Toggle whether a photo is visible to the client portal. ADMIN/OPS only. */
export async function PATCH(req: NextRequest) {
  const { session, user, orgId, org } = await requireOrgSession();
  if (!["ADMIN", "OPS"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace is read-only." }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  const visibility = req.nextUrl.searchParams.get("visibility") === "CLIENT" ? "CLIENT" : "INTERNAL";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const photo = await prisma.photo.findUnique({ where: { id }, select: { id: true, jobId: true } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Tenant isolation: the photo's job must be in this org.
  const job = await prisma.job.findFirst({ where: { id: photo.jobId, orgId }, select: { id: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.photo.update({ where: { id }, data: { visibility } });
  await prisma.auditLog.create({
    data: { orgId, jobId: photo.jobId, userId: session.user.id, action: "PHOTO_VISIBILITY_CHANGED", detail: JSON.stringify({ photoId: id, visibility }) },
  }).catch(() => {});

  return NextResponse.json({ success: true, visibility });
}

export async function DELETE(req: NextRequest) {
  const { session, user, orgId, org } = await requireOrgSession();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace is read-only.";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Tenant isolation: ensure the photo belongs to a job in this org.
  const job = await prisma.job.findFirst({ where: { id: photo.jobId, orgId }, select: { id: true } });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isLegacyDisk = photo.url.startsWith("/api/uploads/");
  await prisma.photo.deleteMany({ where: { id, job: { orgId } } });
  await prisma.auditLog.create({
    data: {
      orgId,
      jobId: photo.jobId,
      userId: session.user.id,
      action: "PHOTO_DELETED",
      detail: JSON.stringify({ photoId: id }),
    },
  }).catch((err) => console.error("[upload] audit log (PHOTO_DELETED) failed:", err));

  // Remove the stored object: legacy disk file, or the Blob object.
  if (isLegacyDisk) {
    const uploadsRoot = getUploadsRoot();
    const absPath = path.resolve(uploadsRoot, photo.url.slice("/api/uploads/".length));
    if (absPath.startsWith(path.resolve(uploadsRoot) + path.sep)) {
      try { await unlink(absPath); } catch { /* ignore missing file */ }
    }
  } else {
    await deleteBlobObject(photo.storageKey || photo.url);
  }

  return NextResponse.json({ success: true });
}
