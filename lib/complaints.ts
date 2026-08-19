import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/commercial/document-workflow";

/**
 * Complaint reference, e.g. "EIS-CMP-2026-0004".
 *
 * Was `CMP-${year}-${count+1}` from a per-org `count()`, which broke in three
 * ways against the GLOBAL unique on Complaint.complaintNumber: it carried no org
 * tag, so two tenants sitting on the same count produced the same reference; it
 * counted a lifetime total rather than the year, so the year prefix was
 * decorative; and read-then-write meant two concurrent submissions computed the
 * same number. Every collision surfaced as an uncaught P2002 — a 500 on the
 * public feedback form and the customer portal, both of which are unauthenticated
 * customer-facing pages. The shared counter is atomic and org-tagged.
 */
export async function generateComplaintNumber(orgId: string): Promise<string> {
  return nextDocumentNumber(prisma, "CMP", "complaint", orgId);
}

export const COMPLAINT_CATEGORY_LABELS: Record<string, string> = {
  SERVICE_QUALITY: "Service Quality",
  REPAIR_DELAY: "Repair Delay",
  BILLING: "Billing Issue",
  STAFF_CONDUCT: "Staff Conduct",
  DAMAGE_CAUSED: "Damage Caused",
  UNRESOLVED_FAULT: "Unresolved Fault",
  OTHER: "Other",
};

export const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Received",
  ACKNOWLEDGED: "Acknowledged",
  INVESTIGATING: "Investigating",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const COMPLAINT_STATUS_STYLES: Record<string, string> = {
  RECEIVED: "border-amber-200 bg-amber-50 text-amber-700",
  ACKNOWLEDGED: "border-sky-200 bg-sky-50 text-sky-700",
  INVESTIGATING: "border-violet-200 bg-violet-50 text-violet-700",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSED: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]",
};

export const SLA_HOURS = {
  acknowledgement: 24,
  resolution: 72,
};

// Plain arrays — avoids Turbopack/Prisma enum-undefined runtime error
export const COMPLAINT_STATUSES = [
  "RECEIVED",
  "ACKNOWLEDGED",
  "INVESTIGATING",
  "RESOLVED",
  "CLOSED",
] as const;

export const COMPLAINT_CATEGORIES = [
  "SERVICE_QUALITY",
  "REPAIR_DELAY",
  "BILLING",
  "STAFF_CONDUCT",
  "DAMAGE_CAUSED",
  "UNRESOLVED_FAULT",
  "OTHER",
] as const;

export const COMPLAINT_CHANNEL_WEB = "WEB" as const;

export type ComplaintStatusValue = (typeof COMPLAINT_STATUSES)[number];
export type ComplaintCategoryValue = (typeof COMPLAINT_CATEGORIES)[number];
