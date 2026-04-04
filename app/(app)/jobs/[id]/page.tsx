import { notFound } from "next/navigation";
import { Role } from "@prisma/client";

import { ExternalTechJobView } from "@/components/jobs/ExternalTechJobView";
import { JobDetailTabs } from "@/components/jobs/JobDetailTabs";
import { getClientBill, getExternalTechBill } from "@/lib/billing";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const { session, user } = await getCurrentUserRole();
  const safeReturnTo =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/jobs";

  const canOverseeExternal = user.permissions.includes("can_view_external_updates") || user.permissions.includes("can_view_external_quotes");
  const where =
    user.role === "TECHNICIAN_EXTERNAL" || (user.role === "TECHNICIAN_INTERNAL" && !canOverseeExternal)
      ? { id, assignedToId: session.user.id }
      : { id };

  if (user.role === "TECHNICIAN_EXTERNAL") {
    const job = await prisma.job.findFirst({
      where,
      include: { photos: true },
    });

    if (!job) {
      notFound();
    }

    const jobWithTimeline = job as typeof job & {
      timelineMinMinutes?: number | null;
      timelineMaxMinutes?: number | null;
      timelineConfidence?: "FIRM" | "ESTIMATED" | "PARTS_DEPENDENT" | null;
      timelineNote?: string | null;
    };

    return (
      <ExternalTechJobView
        job={{
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
          updatedAt: job.updatedAt.toISOString(),
          clientApproved: job.clientApproved,
          approvalDate: job.approvalDate ? job.approvalDate.toISOString() : null,
          deviceType: job.deviceType,
          brand: job.brand,
          model: job.model,
          serialOrImei: job.serialOrImei,
          accessories: job.accessories,
          externalDiagnosis: job.externalDiagnosis,
          partsNeeded: job.partsNeeded,
          externalTechBill: getExternalTechBill(job),
          repairTimeline: job.repairTimeline,
          timelineMinMinutes: jobWithTimeline.timelineMinMinutes ?? null,
          timelineMaxMinutes: jobWithTimeline.timelineMaxMinutes ?? null,
          timelineConfidence: jobWithTimeline.timelineConfidence ?? null,
          timelineNote: jobWithTimeline.timelineNote ?? null,
        }}
        returnTo={safeReturnTo}
      />
    );
  }

  const job = await prisma.job.findFirst({
    where,
    include: {
      client: true,
      assignedTo: true,
      photos: true,
      auditLogs: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) {
    notFound();
  }

  const technicians =
    can.assignJobs(user)
      ? await prisma.user.findMany({
          where: {
            isActive: true,
            role: { in: [Role.TECHNICIAN_INTERNAL, Role.TECHNICIAN_EXTERNAL] },
          },
          select: { id: true, name: true, role: true },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        })
      : [];

  const jobWithBilling = {
    ...job,
    externalTechBill: getExternalTechBill(job),
    clientBill: getClientBill(job),
  };

  return <JobDetailTabs role={user.role} permissions={user.permissions} job={jobWithBilling} technicians={technicians} />;
}
