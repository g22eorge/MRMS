import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IntakeClient } from "@/components/intake/IntakeClient";
import { can } from "@/lib/permissions";
import { requireOrgSession } from "@/lib/org-context";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  let user;
  let orgId;
  try {
    ({ user, orgId } = await requireOrgSession());
  } catch {
    redirect("/dashboard");
  }
  if (!can.viewIntake(user)) redirect("/dashboard");

  let requests: Awaited<ReturnType<typeof prisma.repairRequest.findMany>> = [];
  try {
    requests = await prisma.repairRequest.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch {
    requests = [];
  }

  const pending = requests.filter((r) => r.requestStatus === "PENDING_FRONT_DESK" || r.requestStatus === "PENDING_INTAKE").length;

  return (
    <div className="space-y-0">
      <IntakeClient
        initialRequests={requests}
        pending={pending}
        canManageIntake={can.manageIntake(user)}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
