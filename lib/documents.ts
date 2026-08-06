// Type-only import: these are pure status helpers reused by client components
// (e.g. JobDetailTabs), so we must not pull the @prisma/client runtime into the
// browser bundle. String-literal comparisons keep it a compile-time-only type.
import type { JobStatus } from "@prisma/client";

export function formatQuotationNumber(
  jobNumber: string,
  issuedAt: Date,
  prefix: string,
  template: string,
  padLength: number,
) {
  const month = issuedAt.getMonth() + 1;
  const eisMatch = jobNumber.match(/^EIS-(\d{1,2})\/(\d{4})\/(\d+)$/i);
  const eiMatch = jobNumber.match(/^EI-(\d{4})-(\d+)$/i);

  const year = eisMatch?.[2] ?? eiMatch?.[1] ?? String(issuedAt.getFullYear());
  const sequence = eisMatch?.[3] ?? eiMatch?.[2] ?? jobNumber.match(/(\d+)$/)?.[1] ?? "1";
  const serial = String(Number(sequence)).padStart(padLength, "0");

  return template
    .replaceAll("{PREFIX}", prefix)
    .replaceAll("{M}", String(month))
    .replaceAll("{MM}", String(month).padStart(2, "0"))
    .replaceAll("{YYYY}", year)
    .replaceAll("{SEQ}", serial);
}

/**
 * Derive a document number from a repair number by inserting the document type,
 * keeping everything uniform and traceable: job "EIS/2026/0041" →
 * "EIS/INV/2026/0041" (invoice) or "EIS/QT/2026/0041" (quotation). Falls back to
 * a "TYPE-{jobNumber}" form for legacy hyphen/tagged job numbers.
 */
export function deriveDocNumberFromJob(jobNumber: string, type: string) {
  const slash = jobNumber.match(/^(.+?)\/(\d{4})\/(\d+)$/);
  if (slash) {
    const [, prefix, year, seq] = slash;
    return `${prefix}/${type}/${year}/${seq}`;
  }
  return `${type}-${jobNumber}`;
}

export function canGenerateInvoiceForStatus(status: JobStatus) {
  return status === "READY_FOR_PICKUP" || status === "COMPLETED" || status === "CLOSED";
}

export function canGenerateQuotationForStatus(status: JobStatus) {
  const allowed: JobStatus[] = [
    "DIAGNOSING",
    "REFERRED",
    "IN_EXTERNAL_REPAIR",
    "WAITING_FOR_PARTS",
    "RETURNED_FROM_EXTERNAL",
    "AWAITING_APPROVAL",
    "IN_REPAIR",
    "READY_FOR_PICKUP",
    "COMPLETED",
    "CLOSED",
  ];
  return allowed.includes(status);
}
