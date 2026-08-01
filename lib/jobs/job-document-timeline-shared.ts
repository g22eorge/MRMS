/**
 * Client-safe pieces of the job document timeline: types, kind labels, and a
 * pure sort helper. Kept free of any Prisma / server-only imports so client
 * components (e.g. JobDocumentTimeline) can use them without dragging the
 * PrismaClient into the browser bundle. The server loader lives in
 * `./job-document-timeline`, which re-exports these for backward compat.
 */

export type JobDocumentKind = "job_card" | "quotation" | "invoice" | "receipt" | "delivery_note" | "refund";

export type JobDocumentTimelineEntry = {
  id: string;
  kind: JobDocumentKind;
  label: string;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  occurredAt: Date;
  pdfHref: string;
  listHref: string;
};

export const JOB_DOCUMENT_KIND_LABELS: Record<JobDocumentKind, string> = {
  job_card: "Job Card",
  quotation: "Quotation",
  invoice: "Invoice",
  receipt: "Receipt",
  delivery_note: "Delivery Note",
  refund: "Refund",
};

export function sortJobDocumentTimeline(entries: JobDocumentTimelineEntry[]): JobDocumentTimelineEntry[] {
  return [...entries].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}
