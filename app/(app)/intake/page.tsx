import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { IntakeClient } from "@/components/intake/IntakeClient";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const { user } = await getCurrentUserRole();
  if (!can.viewClientInfo(user)) redirect("/dashboard");

  const requests = await prisma.repairRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const pending = requests.filter((r) => r.requestStatus === "PENDING_INTAKE").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Website Repair Requests</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {requests.length} total
            {pending > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">
                {pending} pending review
              </span>
            )}
          </p>
        </div>
      </div>

      <IntakeClient initialRequests={requests} />
    </div>
  );
}
