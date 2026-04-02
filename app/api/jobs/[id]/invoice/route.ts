import { NextRequest, NextResponse } from "next/server";

import { getClientBill, getExternalTechBill } from "@/lib/billing";
import { formatMoney, getAppCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user } = await getCurrentUserRole();

  if (!["ADMIN", "ACCOUNTS", "OPS"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await prisma.job.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currency = getAppCurrency();
  const externalTechBill = getExternalTechBill(job) ?? 0;
  const clientBill = getClientBill(job) ?? 0;

  const text = [
    `Invoice for ${job.jobNumber}`,
    `Client: ${job.client.fullName}`,
    `Device: ${job.brand} ${job.model}`,
    `Status: ${job.status}`,
    `Currency: ${currency}`,
    `External Tech Bill: ${formatMoney(externalTechBill, currency)}`,
    `Our Bill To Client: ${formatMoney(clientBill, currency)}`,
    `Repair Margin: ${formatMoney(clientBill - externalTechBill, currency)}`,
    `Completed: ${job.completedAt?.toISOString() ?? "N/A"}`,
  ].join("\n");

  return new NextResponse(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="invoice-${job.jobNumber}.txt"`,
    },
  });
}
