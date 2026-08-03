import { notFound, redirect } from "next/navigation";

import { EditJobForm } from "@/components/jobs/EditJobForm";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export default async function EditJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const { session, user } = await getCurrentUserRole();

  // Always tenant-scoped by orgId; technicians are further limited to their own jobs.
  const where =
    user.role === "TECHNICIAN_EXTERNAL" || user.role === "TECHNICIAN_INTERNAL"
      ? { id, orgId: user.orgId, assignedToId: session.user.id }
      : { id, orgId: user.orgId };

  const job = await prisma.job.findFirst({ where });

  if (!job) {
    notFound();
  }

  if (user.role === "TECHNICIAN_EXTERNAL" || user.role === "FRONT_DESK") {
    redirect(`/jobs/${id}`);
  }

  const safeReturnTo =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : `/jobs/${id}`;

  return (
    <EditJobForm
      job={{
        id: job.id,
        jobNumber: job.jobNumber,
        brand: job.brand,
        model: job.model,
        serialOrImei: job.serialOrImei,
        technicianNotes: job.technicianNotes,
        issueDescription: job.issueDescription,
      }}
      returnTo={safeReturnTo}
    />
  );
}
