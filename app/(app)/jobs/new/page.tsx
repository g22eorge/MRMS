import { redirect } from "next/navigation";

import { NewJobStepper } from "@/components/jobs/NewJobStepper";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { user } = await getCurrentUserRole();
  if (!can.createJob(user)) {
    redirect("/jobs");
  }

  // Started from a client or a job that already names the customer. The id is
  // read from the URL but never trusted: the client is fetched scoped to the
  // caller's own org, so a pasted or stale id from another tenant simply finds
  // nothing. A miss falls back to the normal search flow rather than erroring —
  // a bad link should cost a search, not a dead page.
  const { clientId } = await searchParams;
  const presetClient =
    clientId && user.orgId
      ? await prisma.client
          .findFirst({
            where: { id: clientId, orgId: user.orgId },
            select: { id: true, fullName: true, phone: true, email: true, organization: true },
          })
          .catch(() => null)
      : null;

  return (
    <div className="space-y-4">
      <NewJobStepper receivedByName={user.name} presetClient={presetClient} />
    </div>
  );
}
