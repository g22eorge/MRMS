import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const prisma = new PrismaClient();

export default async function IntakePage() {
  const session = await getSession();
  
  if (!session) {
    redirect("/login");
  }

  const requests = await prisma.repairRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const statusColors: Record<string, string> = {
    PENDING_INTAKE: "yellow",
    APPROVED: "green",
    REJECTED: "red",
    CONVERTED_TO_JOB: "blue",
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Repair Requests</h1>
        <span className="text-sm text-gray-500">{requests.length} requests</span>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No repair requests yet. Requests from the website will appear here.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{req.requestNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium">{req.customerName}</div>
                    <div className="text-gray-500 text-xs">{req.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>{req.brand} {req.model}</div>
                    <div className="text-gray-500 text-xs">{req.deviceType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${statusColors[req.requestStatus] || "gray"}-100 text-${statusColors[req.requestStatus] || "gray"}-800`}>
                      {req.requestStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
