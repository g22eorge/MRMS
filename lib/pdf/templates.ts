import type { OrgPlan } from "@prisma/client";

import type { ComponentType } from "react";

import { EagleInfoInvoiceAdapter }  from "@/lib/pdf/EagleInfoInvoiceAdapter";
import { EagleInfoJobCardDocument } from "@/lib/pdf/EagleInfoJobCardDocument";
import { EagleInfoQuotationAdapter }from "@/lib/pdf/EagleInfoQuotationAdapter";
import { InvoiceDocumentItemized } from "./InvoiceDocumentItemized";
import { QuotationDocumentTechnical } from "./QuotationDocumentTechnical";
import { InvoiceDocumentExecutive }     from "@/lib/pdf/InvoiceDocumentExecutive";
import { InvoiceDocumentMinimal }       from "@/lib/pdf/InvoiceDocumentMinimal";
import { InvoiceDocumentPremium }       from "@/lib/pdf/InvoiceDocumentPremium";
import { InvoiceDocumentV2 }            from "@/lib/pdf/InvoiceDocumentV2";
import { JobCardDocument }              from "@/lib/pdf/JobCardDocument";
import { JobCardDocumentCompact }       from "@/lib/pdf/JobCardDocumentCompact";
import { JobCardDocumentPremium }       from "@/lib/pdf/JobCardDocumentPremium";
import { JobCardDocumentTechnical }     from "@/lib/pdf/JobCardDocumentTechnical";
import { QuotationDocument }            from "@/lib/pdf/QuotationDocument";
import { QuotationDocumentExecutive }   from "@/lib/pdf/QuotationDocumentExecutive";
import { QuotationDocumentMinimal }     from "@/lib/pdf/QuotationDocumentMinimal";
import { QuotationDocumentModern }      from "@/lib/pdf/QuotationDocumentModern";
import { SaleReceiptDocument }          from "@/lib/pdf/SaleReceiptDocument";
import { SaleReceiptDocumentBranded }   from "@/lib/pdf/SaleReceiptDocumentBranded";
import { SaleReceiptDocumentExecutive } from "@/lib/pdf/SaleReceiptDocumentExecutive";
import { SaleReceiptDocumentItemized }  from "@/lib/pdf/SaleReceiptDocumentItemized";
import { SaleReceiptDocumentThermal }   from "@/lib/pdf/SaleReceiptDocumentThermal";

export type DocKind = "INVOICE" | "QUOTATION" | "JOB_CARD" | "RECEIPT";

export type TemplateKey =
  // Invoice
  | "invoice_classic"
  | "invoice_modern"
  | "invoice_premium"
  | "invoice_minimal"
  | "invoice_itemized"
  | "invoice_executive"
  // Quotation
  | "quote_classic"
  | "quote_modern"
  | "quote_minimal"
  | "quote_detailed"
  | "quote_technical"
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
  { kind: "INVOICE", key: "invoice_itemized",  label: "Itemized",  description: "Every line with stock code and tax, plus paid and balance", previewColor: "bg-teal-600",   minPlan: "PREMIUM",    templateNumber: 5 },
  { kind: "INVOICE", key: "invoice_executive", label: "Executive", description: "Dark header, premium feel for enterprise clients",        previewColor: "bg-slate-800",  minPlan: "ENTERPRISE", templateNumber: 6 },

  // ── QUOTATION ──────────────────────────────────────────────────────────────
  { kind: "QUOTATION", key: "quote_classic",   label: "Default",   description: "Standard quotation with validity period",                previewColor: "bg-slate-500",  minPlan: "STARTER",    templateNumber: 1 },
  { kind: "QUOTATION", key: "quote_modern",    label: "Modern",    description: "Colorful header with summary box",                       previewColor: "bg-blue-500",   minPlan: "STANDARD",   templateNumber: 2 },
  { kind: "QUOTATION", key: "quote_minimal",   label: "Minimal",   description: "Clean, distraction-free presentation",                   previewColor: "bg-zinc-400",   minPlan: "GROWTH",     templateNumber: 3 },
  { kind: "QUOTATION", key: "quote_detailed",  label: "Detailed",  description: "Adds terms, notes, and signature block",                 previewColor: "bg-amber-500",  minPlan: "GROWTH",     templateNumber: 4 },
  { kind: "QUOTATION", key: "quote_technical", label: "Technical", description: "Assessment, per-line specification and an exclusions block", previewColor: "bg-orange-500", minPlan: "PREMIUM",    templateNumber: 5 },
  { kind: "QUOTATION", key: "quote_executive", label: "Executive", description: "Dark premium layout for corporate proposals",            previewColor: "bg-slate-800",  minPlan: "ENTERPRISE", templateNumber: 6 },

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
  { kind: "RECEIPT", key: "receipt_itemized",  label: "Itemized",   description: "Shows every line with SKU, unit price and balance",     previewColor: "bg-teal-600",    minPlan: "PREMIUM",    templateNumber: 4 },
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

/* ── Key → component ───────────────────────────────────────────────────────
   Every resolver used to ignore its key and return the one default, so all
   five choices per document kind rendered the same PDF. The alternates were
   still sitting in lib/pdf/, orphaned when the Eagle Info adapters landed —
   which made the template picker, and the plan tiers gating it, promise
   something the product did not do. An ENTERPRISE customer picking
   "Executive" got the STARTER default.

   These maps are deliberately total over the keys the catalogue advertises:
   an entry here without a catalogue entry is dead, and a catalogue entry
   without one here is the bug this replaces. The ?? fallbacks are for a key
   read from the database that is no longer offered, which resolveTemplateKey
   already screens for.                                                      */

type InvoiceKey   = Extract<TemplateKey, `invoice_${string}`>;
type QuotationKey = Extract<TemplateKey, `quote_${string}`>;
type JobCardKey   = Extract<TemplateKey, `job_card_${string}`>;
type ReceiptKey   = Extract<TemplateKey, `receipt_${string}`>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const INVOICE_TEMPLATES: Record<InvoiceKey, ComponentType<any>> = {
  invoice_classic:   EagleInfoInvoiceAdapter,
  invoice_modern:    InvoiceDocumentV2,
  invoice_premium:   InvoiceDocumentPremium,
  invoice_minimal:   InvoiceDocumentMinimal,
  invoice_itemized:  InvoiceDocumentItemized,
  invoice_executive: InvoiceDocumentExecutive,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QUOTATION_TEMPLATES: Record<QuotationKey, ComponentType<any>> = {
  quote_classic:   EagleInfoQuotationAdapter,
  quote_modern:    QuotationDocumentModern,
  quote_minimal:   QuotationDocumentMinimal,
  quote_detailed:  QuotationDocument,
  quote_technical: QuotationDocumentTechnical,
  quote_executive: QuotationDocumentExecutive,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const JOB_CARD_TEMPLATES: Record<JobCardKey, ComponentType<any>> = {
  job_card_classic:   EagleInfoJobCardDocument,
  job_card_compact:   JobCardDocumentCompact,
  job_card_detailed:  JobCardDocument,
  job_card_technical: JobCardDocumentTechnical,
  job_card_premium:   JobCardDocumentPremium,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RECEIPT_TEMPLATES: Record<ReceiptKey, ComponentType<any>> = {
  receipt_classic:   SaleReceiptDocument,
  receipt_thermal:   SaleReceiptDocumentThermal,
  receipt_branded:   SaleReceiptDocumentBranded,
  receipt_itemized:  SaleReceiptDocumentItemized,
  receipt_executive: SaleReceiptDocumentExecutive,
};

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
export function InvoiceTemplateComponent(key: TemplateKey): ComponentType<any> {
  return INVOICE_TEMPLATES[key as InvoiceKey] ?? EagleInfoInvoiceAdapter;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function QuotationTemplateComponent(key: TemplateKey): ComponentType<any> {
  return QUOTATION_TEMPLATES[key as QuotationKey] ?? EagleInfoQuotationAdapter;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function JobCardTemplateComponent(key: TemplateKey): ComponentType<any> {
  return JOB_CARD_TEMPLATES[key as JobCardKey] ?? EagleInfoJobCardDocument;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReceiptTemplateComponent(key: TemplateKey): ComponentType<any> {
  // Thermal is a paper size, not a look: 80mm till roll.
  return RECEIPT_TEMPLATES[key as ReceiptKey] ?? SaleReceiptDocument;
}
