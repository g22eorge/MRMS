import type { Prisma } from "@prisma/client";

import { roundMoney } from "@/lib/currency";

/**
 * Turn a repair job into invoice lines.
 *
 * Job invoices carried no `InvoiceLine` rows at all: the whole repair was a
 * single `Job.clientBill` and the invoice recorded only a total. That made them
 * impossible to credit line by line — the credit-note dialog had nothing to
 * offer — and left the PDF printing a subtotal that no line item accounted for.
 *
 * Two rules govern what comes out of here:
 *
 * 1. **The invoice total must not move.** `clientBill` is VAT-INCLUSIVE, so the
 *    lines sum to the ex-VAT portion and their tax sums to the VAT, leaving
 *    `subtotal + tax == clientBill` exactly. Adding lines must never restate
 *    what a customer was billed.
 *
 * 2. **Nothing is invented.** Parts actually consumed on the job become their
 *    own lines at their selling price; whatever is left is the labour/service
 *    line. No job on care records parts yet, so today this produces one honest
 *    service line — and becomes a real breakdown by itself the moment parts
 *    start being issued against jobs.
 */

export type JobLineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxAmount: number;
  /** "Part" lines restock and count toward COGS; the service line does neither. */
  sourceType: "Part" | "Custom";
  sourceId: string | null;
  saleUomFactor: number | null;
};

type JobForLines = {
  id: string;
  brand: string | null;
  model: string | null;
  deviceType?: string | null;
  serviceType?: string | null;
  issueDescription?: string | null;
  softwareOsInstall?: boolean | null;
  softwareDriversUpdates?: boolean | null;
  softwareDataBackupRestore?: boolean | null;
  softwareAccountSetup?: boolean | null;
  softwarePerformanceTune?: boolean | null;
  softwareThirdPartyApps?: boolean | null;
};

const SOFTWARE_SERVICES: Array<[keyof JobForLines, string]> = [
  ["softwareOsInstall", "OS install"],
  ["softwareDriversUpdates", "Drivers & updates"],
  ["softwareDataBackupRestore", "Data backup & restore"],
  ["softwareAccountSetup", "Account setup"],
  ["softwarePerformanceTune", "Performance tune-up"],
  ["softwareThirdPartyApps", "Third-party apps"],
];

/** What to call the labour line, using whatever the job actually tells us. */
export function jobServiceDescription(job: JobForLines): string {
  const device = [job.brand, job.model].filter(Boolean).join(" ").trim();

  if (job.serviceType === "SOFTWARE") {
    const picked = SOFTWARE_SERVICES.filter(([key]) => Boolean(job[key])).map(([, label]) => label);
    if (picked.length) return `Software service — ${picked.join(", ")}`;
    return device ? `Software service — ${device}` : "Software service";
  }

  if (device) return `Repair — ${device}`;
  const issue = (job.issueDescription ?? "").trim();
  if (issue) return `Repair — ${issue.slice(0, 80)}`;
  return "Repair service";
}

type PartUsage = {
  partId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  saleUomFactor: number | null;
};

/**
 * Parts issued against this job, from the stock ledger. `PartStockTransaction`
 * is the only record of what a repair consumed — jobs have no parts table of
 * their own — so an OUT movement tagged with the job is the source of truth.
 */
export async function partsUsedOnJob(
  tx: Prisma.TransactionClient,
  params: { orgId: string; jobId: string },
): Promise<PartUsage[]> {
  const movements = await tx.partStockTransaction
    .findMany({
      where: { orgId: params.orgId, jobId: params.jobId, type: "OUT" },
      select: { partId: true, quantity: true },
    })
    .catch(() => [] as Array<{ partId: string; quantity: number }>);
  if (!movements.length) return [];

  const byPart = new Map<string, number>();
  for (const m of movements) byPart.set(m.partId, (byPart.get(m.partId) ?? 0) + Math.abs(m.quantity));

  const parts = await tx.part.findMany({
    where: { id: { in: [...byPart.keys()] }, orgId: params.orgId },
    select: { id: true, name: true, sellingPrice: true, saleUomFactor: true },
  });

  return parts.map((p) => {
    const factor = p.saleUomFactor && p.saleUomFactor > 0 ? p.saleUomFactor : 1;
    // Stock moves in base units; the customer is billed in sale units.
    const baseQty = byPart.get(p.id) ?? 0;
    return {
      partId: p.id,
      name: p.name,
      quantity: baseQty / factor,
      unitPrice: p.sellingPrice ?? 0,
      saleUomFactor: p.saleUomFactor,
    };
  });
}

/**
 * Compose the lines for a job invoice.
 *
 * `clientBill` is what the customer pays, VAT included. `vatRate` is a fraction
 * (0.18), and `vatApplicable` mirrors the job's own flag.
 */
export function buildJobInvoiceLines(params: {
  job: JobForLines;
  clientBill: number;
  vatApplicable: boolean;
  vatRate: number;
  currency: string;
  parts: PartUsage[];
}): JobLineInput[] {
  const { job, clientBill, vatApplicable, vatRate, currency, parts } = params;
  if (!Number.isFinite(clientBill) || clientBill <= 0) return [];

  // Split the inclusive bill into the ex-VAT body and its tax, the same way the
  // invoice PDF already does, so the two agree.
  const exVat = roundMoney(vatApplicable && vatRate > 0 ? clientBill / (1 + vatRate) : clientBill, currency);
  const taxTotal = roundMoney(Math.max(clientBill - exVat, 0), currency);

  const partLines: JobLineInput[] = [];
  let partsSubtotal = 0;
  for (const p of parts) {
    const lineTotal = roundMoney(p.quantity * p.unitPrice, currency);
    if (lineTotal <= 0) continue;
    partsSubtotal += lineTotal;
    partLines.push({
      description: p.name,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      lineTotal,
      taxAmount: 0,
      sourceType: "Part",
      sourceId: p.partId,
      saleUomFactor: p.saleUomFactor,
    });
  }

  // If the parts alone are worth more than the whole bill, the pricing does not
  // decompose — rather than scale the part prices into something untrue, fall
  // back to a single service line for the full amount.
  const labour = roundMoney(exVat - partsSubtotal, currency);
  const lines = labour > 0 && partsSubtotal < exVat ? partLines : [];
  if (lines.length !== partLines.length) partsSubtotal = 0;

  const serviceTotal = roundMoney(exVat - partsSubtotal, currency);
  if (serviceTotal > 0) {
    lines.push({
      description: jobServiceDescription(job),
      quantity: 1,
      unitPrice: serviceTotal,
      lineTotal: serviceTotal,
      taxAmount: 0,
      sourceType: "Custom",
      sourceId: null,
      saleUomFactor: null,
    });
  }
  if (!lines.length) return [];

  // Spread the tax across the lines by value, putting any rounding remainder on
  // the last one so the parts sum back to exactly taxTotal.
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  if (taxTotal > 0 && subtotal > 0) {
    let assigned = 0;
    lines.forEach((line, i) => {
      const isLast = i === lines.length - 1;
      const share = isLast ? roundMoney(taxTotal - assigned, currency) : roundMoney(taxTotal * (line.lineTotal / subtotal), currency);
      line.taxAmount = share;
      assigned += share;
    });
  }

  return lines;
}

/**
 * Replace a job invoice's lines with freshly composed ones.
 *
 * Idempotent, and safe to call on every save: it rebuilds from the job's
 * current state, so changing `clientBill` before the job closes re-itemises
 * correctly. It never touches `Invoice.totalAmount` — the lines are derived
 * from that figure, not the other way round.
 *
 * Reads the org's VAT rate off branding the same minimal way the numbering path
 * does, rather than through getDocumentBrandingSettings, which runs DDL and
 * deadlocks an open interactive transaction on Turso.
 */
export async function syncJobInvoiceLines(
  tx: Prisma.TransactionClient,
  params: { orgId: string; invoiceId: string; job: JobForLines & { vatApplicable?: boolean | null }; clientBill: number; currency: string },
): Promise<number> {
  const { orgId, invoiceId, job, clientBill, currency } = params;

  let vatRatePercent = 18;
  let vatDefaultApplicable = false;
  try {
    const rows = await tx.$queryRaw<Array<{ vatRatePercent: unknown; vatDefaultApplicable: unknown }>>`
      SELECT "vatRatePercent", "vatDefaultApplicable"
      FROM "DocumentBrandingSettings"
      WHERE id = ${orgId} OR orgId = ${orgId}
      LIMIT 1`;
    const row = rows?.[0];
    if (row) {
      const rate = Number(row.vatRatePercent);
      if (Number.isFinite(rate)) vatRatePercent = rate;
      vatDefaultApplicable = Boolean(row.vatDefaultApplicable);
    }
  } catch {
    // Drifted or missing branding — the defaults keep invoicing working.
  }

  const parts = await partsUsedOnJob(tx, { orgId, jobId: job.id });
  const lines = buildJobInvoiceLines({
    job,
    clientBill,
    vatApplicable: job.vatApplicable ?? vatDefaultApplicable,
    vatRate: Math.max(0, vatRatePercent) / 100,
    currency,
    parts,
  });

  await tx.invoiceLine.deleteMany({ where: { invoiceId, orgId } });
  if (!lines.length) return 0;

  await tx.invoiceLine.createMany({
    data: lines.map((l) => ({
      orgId,
      invoiceId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountAmount: 0,
      taxAmount: l.taxAmount,
      lineTotal: l.lineTotal,
      sourceType: l.sourceType,
      sourceId: l.sourceId,
      saleUomFactor: l.saleUomFactor,
    })),
  });
  return lines.length;
}
