"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePortalSession } from "@/lib/portal-auth";
import { createNotificationsForRole } from "@/lib/notifications";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

/** Portal user approves a SENT quotation for one of their repairs. */
export async function approveQuotationAction(formData: FormData): Promise<void> {
  const { org, client, portalUser } = await requirePortalSession();
  const quotationId = String(formData.get("quotationId") ?? "").trim();
  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!quotationId) return;

  // Isolation: the quote must be SENT and belong to a job owned by this client.
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, orgId: org.id, status: "SENT", job: { clientId: client.id } },
    select: { id: true, quoteNumber: true, jobId: true },
  });
  if (!quotation) return;

  await prisma.quotation.update({
    where: { id: quotation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  await createNotificationsForRole({
    orgId: org.id,
    type: "QUOTATION_ACCEPTED",
    title: "Quotation approved by client",
    message: `${portalUser.name} approved ${quotation.quoteNumber} in the client portal.`,
    jobId: quotation.jobId ?? undefined,
    roles: ["ADMIN", "OPS"],
  }).catch(() => {});

  // Best-effort audit: the approval already committed above, so a failing audit
  // write must not 500 the customer (they'd retry an already-accepted quote).
  await writeSystemAuditEvent({
    orgId: org.id,
    entityType: "Quotation",
    entityId: quotation.id,
    action: "QUOTATION_APPROVED_PORTAL",
    summary: `${quotation.quoteNumber} approved by portal user ${portalUser.name}`,
  }).catch(() => {});

  if (jobId) revalidatePath(`/portal/repairs/${jobId}`);
}

/** Portal user posts a message/note on one of their repairs (two-way with staff). */
export async function postRepairMessageAction(formData: FormData): Promise<void> {
  const { org, client, portalUser } = await requirePortalSession();
  const jobId = String(formData.get("jobId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!jobId || body.length === 0) return;

  // Isolation: the job must belong to this client + shop.
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId: org.id, clientId: client.id },
    select: { id: true, jobNumber: true },
  });
  if (!job) return;

  await prisma.repairMessage.create({
    data: {
      orgId: org.id,
      jobId: job.id,
      clientId: client.id,
      authorType: "CUSTOMER",
      authorId: portalUser.id,
      authorName: portalUser.name,
      body: body.slice(0, 4000),
    },
  });

  await createNotificationsForRole({
    orgId: org.id,
    type: "PORTAL_MESSAGE",
    title: "New message from a client",
    message: `${portalUser.name} left a message on ${job.jobNumber}.`,
    jobId: job.id,
    roles: ["ADMIN", "OPS"],
  }).catch(() => {});

  revalidatePath(`/portal/repairs/${job.id}`);
}
