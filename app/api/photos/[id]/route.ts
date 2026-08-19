import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getOrgSessionOptional } from "@/lib/org-context";
import { getPortalSession } from "@/lib/portal-auth";
import { streamPrivateBlob } from "@/lib/blob-storage";

// Roles that may view a job's photos in the staff app.
const STAFF_VIEW_ROLES = new Set([
  "ADMIN", "OPS", "FRONT_DESK", "TECHNICIAN_INTERNAL", "TECHNICIAN_EXTERNAL",
]);

/**
 * Authenticated relay for a private repair photo. The blob itself is private
 * (not directly reachable); this route decides who may see it:
 *  - staff: any member of the photo's org, or
 *  - portal client: only a CLIENT-visible photo on a job belonging to one of
 *    their accessible accounts.
 * then streams the bytes. Nothing is served from a guessable URL.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: {
      url: true, storageKey: true, mimeType: true, visibility: true,
      job: { select: { orgId: true, clientId: true, assignedToId: true } },
    },
  });
  if (!photo || !photo.job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let authorised = false;

  // Staff path — any in-org staff member may view the job's photos, EXCEPT
  // technicians, who are limited to jobs assigned to them. Every sibling photo
  // route already enforces this (api/upload, api/uploads/[...segments],
  // api/jobs/[id]); this one did not, so an external technician holding any
  // photo id in the org could stream jobs they were never assigned.
  const staff = await getOrgSessionOptional();
  if (staff.user && staff.orgId && staff.orgId === photo.job.orgId && STAFF_VIEW_ROLES.has(staff.user.role)) {
    const isTechnician = staff.user.role === "TECHNICIAN_EXTERNAL" || staff.user.role === "TECHNICIAN_INTERNAL";
    authorised = !isTechnician || photo.job.assignedToId === staff.user.id;
  }

  // Portal path — client-visible photos on one of the login's own accounts only.
  if (!authorised) {
    const portal = await getPortalSession();
    if (
      portal &&
      photo.visibility === "CLIENT" &&
      portal.org.id === photo.job.orgId &&
      photo.job.clientId != null &&
      portal.accessibleClients.some((c) => c.id === photo.job!.clientId)
    ) {
      authorised = true;
    }
  }

  if (!authorised) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const blob = await streamPrivateBlob(photo.storageKey || photo.url);
  if (!blob) return NextResponse.json({ error: "Unavailable" }, { status: 404 });

  return new NextResponse(blob.stream, {
    headers: {
      "content-type": photo.mimeType || blob.contentType,
      "cache-control": "private, max-age=300",
    },
  });
}
