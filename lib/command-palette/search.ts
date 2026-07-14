import type { Prisma } from "@prisma/client";

import { can } from "@/lib/permissions";
import { phoneLookupVariants } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import { normalizeCommandQuery, type CommandPaletteSearchResult } from "./quick-actions";

const RESULT_LIMIT = 5;

export async function searchCommandPalette(input: {
  orgId: string;
  userId: string;
  role: string;
  permissions?: string[];
  query: string;
}): Promise<CommandPaletteSearchResult[]> {
  const q = normalizeCommandQuery(input.query);
  if (q.length < 2) return [];

  const permissionUser = { role: input.role as never, permissions: input.permissions ?? [] };
  const results: CommandPaletteSearchResult[] = [];

  const jobWhere: Prisma.JobWhereInput =
    input.role === "TECHNICIAN_EXTERNAL" || input.role === "TECHNICIAN_INTERNAL"
      ? { orgId: input.orgId, assignedToId: input.userId }
      : { orgId: input.orgId };

  if (can.searchJobs(permissionUser)) {
    const jobs = await prisma.job.findMany({
      where: {
        ...jobWhere,
        OR: [
          { jobNumber: { contains: q } },
          { serialOrImei: { contains: q } },
          ...(can.viewClientInfo(permissionUser)
            ? [{ client: { is: { fullName: { contains: q } } } }]
            : []),
        ],
      },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        client: can.viewClientInfo(permissionUser) ? { select: { fullName: true } } : false,
      },
      orderBy: { updatedAt: "desc" },
      take: RESULT_LIMIT,
    });

    for (const job of jobs) {
      const clientLabel = job.client?.fullName;
      results.push({
        id: `job-${job.id}`,
        kind: "job",
        label: job.jobNumber,
        description: clientLabel ? `${clientLabel} · ${job.status.replaceAll("_", " ")}` : job.status.replaceAll("_", " "),
        href: `/jobs/${job.id}`,
      });
    }
  }

  if (can.viewClientInfo(permissionUser)) {
    const phoneVariants = phoneLookupVariants(q);
    const clients = await prisma.client.findMany({
      where: {
        orgId: input.orgId,
        OR: [
          { fullName: { contains: q } },
          { email: { contains: q } },
          { organization: { contains: q } },
          ...(phoneVariants.length > 0 ? phoneVariants.map((phone) => ({ phone: { contains: phone } })) : []),
        ],
      },
      select: { id: true, fullName: true, phone: true, email: true },
      orderBy: { updatedAt: "desc" },
      take: RESULT_LIMIT,
    });

    for (const client of clients) {
      results.push({
        id: `client-${client.id}`,
        kind: "client",
        label: client.fullName,
        description: [client.phone, client.email].filter(Boolean).join(" · ") || "Client",
        href: `/clients?q=${encodeURIComponent(client.fullName)}`,
      });
    }
  }

  if (can.viewFinancials(permissionUser)) {
    const invoices = await prisma.invoice.findMany({
      where: {
        orgId: input.orgId,
        OR: [
          { invoiceNumber: { contains: q } },
          { job: { is: { jobNumber: { contains: q } } } },
          { client: { is: { fullName: { contains: q } } } },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        job: { select: { id: true, jobNumber: true } },
        client: { select: { fullName: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: RESULT_LIMIT,
    });

    for (const invoice of invoices) {
      const context = invoice.job?.jobNumber ?? invoice.client?.fullName ?? invoice.status;
      results.push({
        id: `invoice-${invoice.id}`,
        kind: "invoice",
        label: invoice.invoiceNumber,
        description: context,
        href: invoice.job?.id
          ? `/jobs/${invoice.job.id}?tab=financials`
          : `/documents/invoices?q=${encodeURIComponent(invoice.invoiceNumber)}`,
      });
    }
  }

  return results.slice(0, 15);
}
