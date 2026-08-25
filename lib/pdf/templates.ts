import type { OrgPlan } from "@prisma/client";

import type { ComponentType } from "react";

import { EagleInfoInvoiceAdapter }  from "@/lib/pdf/EagleInfoInvoiceAdapter";
import { EagleInfoJobCardDocument } from "@/lib/pdf/EagleInfoJobCardDocument";
import { EagleInfoQuotationAdapter }from "@/lib/pdf/EagleInfoQuotationAdapter";
import { SaleReceiptDocument }          from "@/lib/pdf/SaleReceiptDocument";
import { SaleReceiptDocumentThermal }   from "@/lib/pdf/SaleReceiptDocumentThermal";

export type DocKind = "INVOICE" | "QUOTATION" | "JOB_CARD" | "RECEIPT";

export type TemplateKey =
  // Invoice
  | "invoice_classic"
  | "invoice_modern"
  | "invoice_premium"
  | "invoice_minimal"
  | "invoice_executive"
  // Quotation
  | "quote_classic"
  | "quote_modern"
  | "quote_minimal"
  | "quote_detailed"
  | "quote_executive"
  // Job Card
  | "job_card_classic"
  | "job_card_compact"
  | "job_card_detailed"
  | "job_card_technical"
  | "job_card_premium"
  // Receipt
  | "receipt_classic"
  | "receipt_thermal"
  | "receipt_branded"
  | "receipt_itemized"
  | "receipt_executive";

export type TemplateDef = {
  kind: DocKind;
  key: TemplateKey;
  label: string;
  description: string;
  previewColor: string; // Tailwind color class for preview swatch
  minPlan: OrgPlan;
  templateNumber: number; // 1-5 per kind
};

const PLAN_ORDER: Record<OrgPlan, number> = {
  STARTER:    1,
  STANDARD:   2,
  GROWTH:     3,
  PREMIUM:    4,
  ENTERPRISE: 5,
};

function planAllows(current: OrgPlan, minPlan: OrgPlan) {
  return PLAN_ORDER[current] >= PLAN_ORDER[minPlan];
}

export const DOC_TEMPLATES: TemplateDef[] = [
  // ── INVOICE ────────────────────────────────────────────────────────────────
  { kind: "INVOICE", key: "invoice_classic",   label: "Default",   description: "Clean professional layout, works everywhere",            previewColor: "bg-slate-500",  minPlan: "STARTER",    templateNumber: 1 },
  { kind: "INVOICE", key: "invoice_modern",    label: "Modern",    description: "Two-column layout with accent sidebar",                  previewColor: "bg-blue-500",   minPlan: "STANDARD",   templateNumber: 2 },
  { kind: "INVOICE", key: "invoice_premium",   label: "Premium",   description: "Full-color header with logo prominence",                 previewColor: "bg-violet-500", minPlan: "GROWTH",     templateNumber: 3 },
  { kind: "INVOICE", key: "invoice_minimal",   label: "Minimal",   description: "Ultra-clean, no borders, whitespace-focused",            previewColor: "bg-zinc-400",   minPlan: "GROWTH",     templateNumber: 4 },
  { kind: "INVOICE", key: "invoice_executive", label: "Executive", description: "Dark header, premium feel for enterprise clients",        previewColor: "bg-slate-800",  minPlan: "ENTERPRISE", templateNumber: 5 },

  // ── QUOTATION ──────────────────────────────────────────────────────────────
  { kind: "QUOTATION", key: "quote_classic",   label: "Default",   description: "Standard quotation with validity period",                previewColor: "bg-slate-500",  minPlan: "STARTER",    templateNumber: 1 },
  { kind: "QUOTATION", key: "quote_modern",    label: "Modern",    description: "Colorful header with summary box",                       previewColor: "bg-blue-500",   minPlan: "STANDARD",   templateNumber: 2 },
  { kind: "QUOTATION", key: "quote_minimal",   label: "Minimal",   description: "Clean, distraction-free presentation",                   previewColor: "bg-zinc-400",   minPlan: "GROWTH",     templateNumber: 3 },
  { kind: "QUOTATION", key: "quote_detailed",  label: "Detailed",  description: "Adds terms, notes, and signature block",                 previewColor: "bg-amber-500",  minPlan: "GROWTH",     templateNumber: 4 },
  { kind: "QUOTATION", key: "quote_executive", label: "Executive", description: "Dark premium layout for corporate proposals",             previewColor: "bg-slate-800",  minPlan: "ENTERPRISE", templateNumber: 5 },

  // ── JOB_CARD ───────────────────────────────────────────────────────────────
  { kind: "JOB_CARD", key: "job_card_classic",   label: "Default",   description: "Standard workshop job card with diagnosis",            previewColor: "bg-slate-500",  minPlan: "STARTER",    templateNumber: 1 },
  { kind: "JOB_CARD", key: "job_card_compact",   label: "Compact",   description: "Space-efficient, fits more on one page",               previewColor: "bg-sky-500",    minPlan: "STANDARD",   templateNumber: 2 },
  { kind: "JOB_CARD", key: "job_card_detailed",  label: "Detailed",  description: "Expanded fields for complex repairs",                  previewColor: "bg-indigo-500", minPlan: "GROWTH",     templateNumber: 3 },
  { kind: "JOB_CARD", key: "job_card_technical", label: "Technical", description: "Includes system checklist and test results",           previewColor: "bg-orange-500", minPlan: "PREMIUM",    templateNumber: 4 },
  { kind: "JOB_CARD", key: "job_card_premium",   label: "Premium",   description: "Branded cover + checklist for enterprise",             previewColor: "bg-slate-800",  minPlan: "ENTERPRISE", templateNumber: 5 },

  // ── RECEIPT ────────────────────────────────────────────────────────────────
  { kind: "RECEIPT", key: "receipt_classic",   label: "Default",    description: "Simple payment receipt",                               previewColor: "bg-slate-500",   minPlan: "STARTER",    templateNumber: 1 },
  { kind: "RECEIPT", key: "receipt_thermal",   label: "Thermal",    description: "Narrow 80mm thermal printer format",                   previewColor: "bg-neutral-600", minPlan: "STANDARD",   templateNumber: 2 },
  { kind: "RECEIPT", key: "receipt_branded",   label: "Branded",    description: "Full logo header with payment breakdown",              previewColor: "bg-emerald-600", minPlan: "GROWTH",     templateNumber: 3 },
  { kind: "RECEIPT", key: "receipt_itemized",  label: "Itemized",   description: "Shows line items from the invoice",                    previewColor: "bg-teal-600",    minPlan: "PREMIUM",    templateNumber: 4 },
  { kind: "RECEIPT", key: "receipt_executive", label: "Executive",  description: "Dark premium format for high-value payments",          previewColor: "bg-slate-800",   minPlan: "ENTERPRISE", templateNumber: 5 },
];

export function templatesFor(kind: DocKind, plan: OrgPlan) {
  return DOC_TEMPLATES.filter((t) => t.kind === kind && planAllows(plan, t.minPlan));
}

export function templatesForAll(kind: DocKind) {
  return DOC_TEMPLATES.filter((t) => t.kind === kind);
}

export function splitTemplatesByPlan(kind: DocKind, plan: OrgPlan) {
  const all = templatesForAll(kind);
  const allowed = all.filter((t) => planAllows(plan, t.minPlan));
  const locked = all.filter((t) => !planAllows(plan, t.minPlan));
  return { allowed, locked };
}

export function planLabel(plan: OrgPlan) {
  const labels: Record<OrgPlan, string> = {
    STARTER:    "Duuka",
    STANDARD:   "Duuka Plus",
    GROWTH:     "Duuka Pro",
    PREMIUM:    "Duuka Max",
    ENTERPRISE: "Duuka ProMax",
  };
  return labels[plan] ?? plan;
}

export function resolveTemplateKey(params: {
  kind: DocKind;
  requestedKey: string | null | undefined;
  plan: OrgPlan;
}): TemplateKey {
  const allowed = templatesFor(params.kind, params.plan);
  const requested = params.requestedKey as TemplateKey;
  if (allowed.some((t) => t.key === requested)) return requested;
  return allowed[0]?.key ?? (fallbackKeyForKind(params.kind) as TemplateKey);
}

function fallbackKeyForKind(kind: DocKind) {
  if (kind === "INVOICE") return "invoice_classic";
  if (kind === "QUOTATION") return "quote_classic";
  if (kind === "JOB_CARD") return "job_card_classic";
  return "receipt_classic";
}

// The alternate template components are still in lib/pdf/ but are no longer
// imported here. They are kept so an alternate can be rebuilt in the house
// style later rather than written from scratch.

// Different templates have different prop types; the caller is responsible for
// supplying a compatible props object.
//
// Every kind resolves to the house template regardless of the stored key.
// The alternates (Modern, Minimal, Premium, Executive, Compact, Technical) were
// each designed separately and none of them were carried through the house
// restyle, so selecting one used to hand a customer a document that looked
// nothing like the rest of their paperwork. No tenant on either production
// database is on anything but "_classic", so nothing in use changes; the keys
// are still stored and honoured the moment an alternate is rebuilt.
//
// The one deliberate exception is the thermal receipt, further down. That is a
// paper format for an 80mm till roll, not a style choice.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InvoiceTemplateComponent(_key: TemplateKey): ComponentType<any> {
  return EagleInfoInvoiceAdapter;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function QuotationTemplateComponent(_key: TemplateKey): ComponentType<any> {
  return EagleInfoQuotationAdapter;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function JobCardTemplateComponent(_key: TemplateKey): ComponentType<any> {
  return EagleInfoJobCardDocument;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReceiptTemplateComponent(key: TemplateKey): ComponentType<any> {
  // Thermal is a paper size, not a look: 80mm till roll. Keep it.
  if (key === "receipt_thermal") return SaleReceiptDocumentThermal;
  return SaleReceiptDocument;
}
