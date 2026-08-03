import { type Prisma } from "@prisma/client";

import { DOCUMENTS_ROUTES } from "@/lib/documents/routes";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { phoneLookupVariants } from "@/lib/phone";

import type { CommandPaletteUser } from "./quick-actions";
import type { CommandPaletteSearchHit } from "./types";

const RESULT_LIMIT = 5;

function buildJobWhere(params: {
  orgId: string;
  userId: string;
  user: CommandPaletteUser;
  q: string;
}): Prisma.JobWhereInput {
  const { orgId, userId, user, q } = params;
  const phoneVariants = phoneLookupVariants(q);

  const textOr: Prisma.JobWhereInput[] = [
    { jobNumber: { contains: q } },
    { brand: { contains: q } },
    { model: { contains: q } },
    { serialOrImei: { contains: q } },
    { device: { brand: { contains: q } } },
    { device: { model: { contains: q } } },
  ];

  if (user.role !== "TECHNICIAN_EXTERNAL") {
    textOr.push(
      { client: { fullName: { contains: q } } },
      { client: { phone: { contains: q } } },
      { issueDescription: { contains: q } },
    );
    for (const phone of phoneVariants) {
      textOr.push({ client: { phone: { contains: phone } } });
    }
  }

  const where: Prisma.JobWhereInput = {
    orgId,
    OR: textOr,
  };

  if (user.role === "TECHNICIAN_EXTERNAL") {
    where.assignedToId = userId;
  } else if (user.role === "TECHNICIAN_INTERNAL") {
    const canOversee =
      user.permissions?.includes("can_view_external_updates") ||
      user.permissions?.includes("can_view_external_quotes") ||
      can.approveInvoices(user);
    if (!canOversee) {
      where.assignedToId = userId;
    }
  }

  return where;
}

export async function searchCommandPalette(params: {
  orgId: string;
  userId: string;
  user: CommandPaletteUser;
  q: string;
}): Promise<CommandPaletteSearchHit[]> {
  const q = params.q.trim();
  if (q.length < 2) return [];

  const hits: CommandPaletteSearchHit[] = [];

  if (can.searchJobs(params.user)) {
    if (params.user.role === "TECHNICIAN_EXTERNAL") {
      const jobs = await prisma.job.findMany({
        where: buildJobWhere(params),
        select: {
          id: true,
          jobNumber: true,
          status: true,
          brand: true,
          model: true,
        },
        orderBy: { updatedAt: "desc" },
        take: RESULT_LIMIT,
      });

      for (const job of jobs) {
        const device = [job.brand, job.model].filter(Boolean).join(" ").trim();
        hits.push({
          id: `job-${job.id}`,
          kind: "job",
          label: job.jobNumber,
          description: device || job.status.replaceAll("_", " "),
          href: `/jobs/${job.id}`,
        });
      }
    } else {
      const jobs = await prisma.job.findMany({
        where: buildJobWhere(params),
        select: {
          id: true,
          jobNumber: true,
          status: true,
          brand: true,
          model: true,
          client: { select: { fullName: true, phone: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: RESULT_LIMIT,
      });

      for (const job of jobs) {
        const device = [job.brand, job.model].filter(Boolean).join(" ").trim();
        const clientLine = job.client
          ? `${job.client.fullName}${job.client.phone ? ` · ${job.client.phone}` : ""}`
          : device || job.status.replaceAll("_", " ");
        hits.push({
          id: `job-${job.id}`,
          kind: "job",
          label: job.jobNumber,
          description: clientLine,
          href: `/jobs/${job.id}`,
        });
      }
    }
  }

  if (can.viewClientInfo(params.user)) {
    const phoneVariants = phoneLookupVariants(q);
    const clientOr: Prisma.ClientWhereInput[] = [
      { fullName: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
      { organization: { contains: q } },
    ];
    for (const phone of phoneVariants) {
      clientOr.push({ phone: { contains: phone } });
    }

    const clients = await prisma.client.findMany({
      where: { orgId: params.orgId, OR: clientOr },
      select: { id: true, fullName: true, phone: true, email: true },
      orderBy: { updatedAt: "desc" },
      take: RESULT_LIMIT,
    });

    for (const client of clients) {
      hits.push({
        id: `client-${client.id}`,
        kind: "client",
        label: client.fullName,
        description: [client.phone, client.email].filter(Boolean).join(" · ") || "Client",
        href: `/clients/${client.id}`,
      });
    }
  }

  if (can.viewFinancials(params.user)) {
    const invoices = await prisma.invoice.findMany({
      where: {
        orgId: params.orgId,
        OR: [
          { invoiceNumber: { contains: q } },
          { subject: { contains: q } },
          { client: { fullName: { contains: q } } },
          { client: { phone: { contains: q } } },
          { job: { jobNumber: { contains: q } } },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        client: { select: { fullName: true } },
        job: { select: { jobNumber: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: RESULT_LIMIT,
    });

    for (const invoice of invoices) {
      const context = invoice.job?.jobNumber ?? invoice.client?.fullName ?? invoice.status;
      hits.push({
        id: `invoice-${invoice.id}`,
        kind: "invoice",
        label: invoice.invoiceNumber,
        description: context,
        href: `${DOCUMENTS_ROUTES.invoices}?q=${encodeURIComponent(invoice.invoiceNumber)}`,
      });
    }

    const quotations = await prisma.quotation.findMany({
      where: {
        orgId: params.orgId,
        OR: [
          { quoteNumber: { contains: q } },
          { client: { fullName: { contains: q } } },
          { job: { jobNumber: { contains: q } } },
        ],
      },
      select: { id: true, quoteNumber: true, status: true, client: { select: { fullName: true } }, job: { select: { jobNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: RESULT_LIMIT,
    });
    for (const quotation of quotations) {
      hits.push({
        id: `quotation-${quotation.id}`,
        kind: "quotation",
        label: quotation.quoteNumber,
        description: quotation.job?.jobNumber ?? quotation.client?.fullName ?? quotation.status,
        href: `${DOCUMENTS_ROUTES.quotations}?q=${encodeURIComponent(quotation.quoteNumber)}`,
      });
    }
  }

  if (can.manageInventory(params.user)) {
    const [products, suppliers] = await Promise.all([
      prisma.part.findMany({
        where: { orgId: params.orgId, isActive: true, OR: [{ sku: { contains: q } }, { name: { contains: q } }] },
        select: { id: true, sku: true, name: true, qtyOnHand: true },
        orderBy: { name: "asc" },
        take: RESULT_LIMIT,
      }),
      prisma.supplier.findMany({
        where: { orgId: params.orgId, OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
        take: RESULT_LIMIT,
      }),
    ]);
    for (const product of products) {
      hits.push({
        id: `product-${product.id}`,
        kind: "product",
        label: product.name,
        description: `${product.sku} · ${product.qtyOnHand} in stock`,
        href: `/inventory/${product.id}`,
      });
    }
    for (const supplier of suppliers) {
      hits.push({
        id: `supplier-${supplier.id}`,
        kind: "supplier",
        label: supplier.name,
        description: supplier.phone ?? "Supplier",
        href: `/inventory/suppliers/${supplier.id}`,
      });
    }
  }

  return hits.slice(0, RESULT_LIMIT * 4);
}
