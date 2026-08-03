import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDocDate } from "@/lib/date-eat";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { resolvePdfLogo, compactText, prettyEnum } from "@/lib/pdf/pdf-utils";
import { AssessmentReportDocument, type ScopeRow, type CostRow } from "@/lib/pdf/AssessmentReportDocument";

export type GenerateAssessmentResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; error: string };

const paras = (t?: string | null) =>
  (t ?? "").split(/\n{2,}|\r?\n/).map((p) => p.trim()).filter(Boolean);

/**
 * Keep whole sentences from `items` up to a character budget, without cutting
 * mid-word. Used to hold a single-component report to one page while still
 * reading as complete prose. Multi-component reports skip this and run full.
 */
function clampParas(items: string[], maxChars: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const p of items) {
    if (used >= maxChars) break;
    const remaining = maxChars - used;
    if (p.length <= remaining) {
      out.push(p);
      used += p.length + 1;
      continue;
    }
    const slice = p.slice(0, remaining);
    const stop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
    const cut = stop > 40 ? slice.slice(0, stop + 1) : slice.replace(/\s+\S*$/, "").trim();
    if (cut) out.push(cut);
    break;
  }
  return out.length ? out : items.slice(0, 1);
}

/**
 * Render the branded Hardware Assessment & Repair Report PDF for a job.
 * `requireClientVisible` gates it to a published (CLIENT) report — used by the
 * portal so a customer can only download a report staff have approved.
 */
export async function generateAssessmentBuffer(params: {
  orgId: string;
  jobId: string;
  requireClientVisible?: boolean;
}): Promise<GenerateAssessmentResult> {
  const { orgId, jobId } = params;

  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      jobNumber: true, issueDescription: true, brand: true, model: true, deviceType: true,
      diagnosisNotes: true, externalDiagnosis: true, partsNeeded: true, recommendedRepair: true, workDone: true, clientBill: true,
      warrantyMonths: true, warrantyExpiresAt: true,
      client: { select: { fullName: true, organization: true } },
      quotations: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { totalAmount: true, currency: true, status: true, items: { select: { description: true, quantity: true, lineTotal: true } } },
      },
    },
  });
  if (!job) return { ok: false, error: "Repair not found" };

  // The report requires the diagnosis and repair details to be completed first.
  // Parts are optional — a report can still be produced without them. "Diagnosis"
  // and "repair details" each live in more than one field depending on the
  // workflow (in-house vs external, recommendation vs work done).
  const hasDiagnosis = Boolean(((job.diagnosisNotes ?? "") + (job.externalDiagnosis ?? "")).trim());
  const hasRepairDetails = Boolean(((job.recommendedRepair ?? "") + (job.workDone ?? "")).trim());
  if (!hasDiagnosis || !hasRepairDetails) {
    return { ok: false, error: "Complete the diagnosis and repair details before the report can be downloaded (parts are optional)." };
  }

  const report = await prisma.diagnosisReport.findFirst({
    where: {
      orgId, jobId,
      ...(params.requireClientVisible ? { NOT: { visibility: "INTERNAL" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { summary: true, findings: true, recommendedWork: true, riskNotes: true },
  });
  if (!report) {
    return { ok: false, error: params.requireClientVisible ? "No published assessment report is available yet" : "No assessment report exists for this repair" };
  }

  const branding = await getDocumentBrandingSettings(orgId);
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { baseCurrency: true } }).catch(() => null);
  const currency = normalizeCurrency(org?.baseCurrency, "UGX");
  const logoUrl = await resolvePdfLogo();

  // Component count drives length: the report is held to a single page for a
  // single-component estimate, and only allowed to run longer when the estimate
  // spans more than one component (multiple quote line items or parts).
  const partLines = (job.partsNeeded ?? "").split(/\r?\n|,/).map((p) => p.trim()).filter(Boolean);
  const quote = job.quotations[0];
  const componentCount = quote && quote.items.length > 0 ? quote.items.length : partLines.length;
  const multiComponent = componentCount > 1;

  // ── Section 1: findings (fall back to summary if empty) ──
  const findingsRaw = paras(report.findings).length > 0 ? paras(report.findings) : paras(report.summary);
  const findings = multiComponent ? findingsRaw : clampParas(findingsRaw, 560);

  // ── Section 2: repair scope (from parts, else a single derived row) + lead ──
  const repairScope: ScopeRow[] = partLines.length > 0
    ? partLines.map((p) => ({ component: p, specification: "Replacement / repair as assessed" }))
    : (report.recommendedWork
        ? [{ component: `${job.brand} ${job.model}`.trim() || "Device", specification: "Repair as detailed in the recommended solution above." }]
        : []);
  const recommendedSolution = multiComponent
    ? compactText(report.recommendedWork, 600)
    : clampParas(paras(report.recommendedWork), 320).join(" ");

  // ── Section 3: repair recommendation — shown only on multi-component reports (kept off the single page) ──
  const repairRecommendation = multiComponent && paras(report.findings).length > 0
    ? compactText(report.summary, 400) || undefined
    : undefined;

  // ── Section 4: estimated cost ──
  let costRows: CostRow[];
  let totalCostValue: string;
  const qCurrency = normalizeCurrency(quote?.currency, currency);
  if (quote && quote.totalAmount > 0 && quote.items.length > 0) {
    costRows = quote.items.map((it) => ({ description: it.description, amount: formatMoney(it.lineTotal, qCurrency) }));
    totalCostValue = formatMoney(quote.totalAmount, qCurrency);
  } else if (quote && quote.totalAmount > 0) {
    costRows = [{ description: "Repair service", amount: formatMoney(quote.totalAmount, qCurrency) }];
    totalCostValue = formatMoney(quote.totalAmount, qCurrency);
  } else if ((job.clientBill ?? 0) > 0) {
    costRows = [{ description: "Repair service", amount: formatMoney(job.clientBill!, currency) }];
    totalCostValue = formatMoney(job.clientBill!, currency);
  } else {
    costRows = [
      { description: repairScope[0]?.component ?? "Repair service", amount: "Pending" },
      { description: "Labour & Installation", amount: "Included / As per service agreement" },
    ];
    totalCostValue = "Pending – awaiting supplier quotation";
  }

  // ── Section 5: warranty & support ──
  const warranty = multiComponent ? paras(report.riskNotes) : clampParas(paras(report.riskNotes), 300);
  if (job.warrantyExpiresAt && job.warrantyMonths) {
    warranty.push(`This repair carries a ${job.warrantyMonths}-month warranty, valid until ${formatEATDocDate(job.warrantyExpiresAt)}.`);
  } else if (warranty.length === 0) {
    warranty.push("Replacement components are supplied with applicable supplier warranty, where applicable. The system is tested after repair to confirm stable operation.");
  }

  const address = [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join(", ");
  const footerText = [branding.companyName, branding.companyEmail || branding.companyWebsite, address]
    .filter(Boolean).join("  |  ");

  const element = createElement(AssessmentReportDocument, {
    companyName: branding.companyName,
    companyTagline: branding.companyTagline ?? "",
    companyAddress: address,
    companyLogoUrl: logoUrl,
    jobNumber: job.jobNumber,
    preparedForName: job.client?.fullName ?? "",
    preparedForOrg: compactText(job.client?.organization, 60),
    deviceIssue: compactText(job.issueDescription, 120) || `${prettyEnum(job.deviceType)} repair`,
    findings: findings.length > 0 ? findings : ["Assessment completed. Details available on request."],
    recommendedSolution,
    repairScope,
    repairRecommendation,
    costRows,
    totalCostLabel: "Total Replacement Cost:",
    totalCostValue,
    warranty,
    preparedByOrg: branding.companyName,
    preparedByDept: "Technical Department",
    dateText: formatEATDocDate(new Date()),
    footerText,
  });

  const buffer = await renderToBuffer(element as never);
  return { ok: true, buffer, filename: `assessment-${job.jobNumber}.pdf` };
}
