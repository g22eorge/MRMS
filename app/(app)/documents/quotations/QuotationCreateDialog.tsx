"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NewQuotationForm } from "@/app/(app)/sales/quotations/new/NewQuotationForm";

type ClientOption = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  organization: string | null;
  address: string | null;
};

type LeadOption = {
  id: string;
  fullName: string;
  phone: string | null;
  organization: string | null;
  interest: string | null;
};

type JobOption = {
  id: string;
  jobNumber: string;
  brand: string;
  model: string;
  client: { fullName: string; phone: string | null; address: string | null } | null;
};

type PartOption = { id: string; sku: string; name: string; unitCost: number | null; sellingPrice?: number | null; taxable?: boolean; taxRate?: number | null; qtyOnHand: number };

type TaxRateOption = { id: string; name: string; code: string; rate: number; isDefault: boolean };

type Props = {
  currency: string;
  canOverrideDiscount: boolean;
  clients: ClientOption[];
  leads: LeadOption[];
  jobs: JobOption[];
  parts: PartOption[];
  taxRates: TaxRateOption[];
  defaultTaxApplicable: boolean;
  defaultTaxRate: number;
  defaultTaxLabel: string;
};

export function QuotationCreateDialog({
  currency,
  canOverrideDiscount,
  clients,
  leads,
  jobs,
  parts,
  taxRates,
  defaultTaxApplicable,
  defaultTaxRate,
  defaultTaxLabel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const opener = () => setOpen(true);
    const closer = () => close();
    window.addEventListener("quotation-create-dialog:open", opener);
    window.addEventListener("quotation-create-dialog:close", closer);
    return () => {
      window.removeEventListener("quotation-create-dialog:open", opener);
      window.removeEventListener("quotation-create-dialog:close", closer);
    };
  }, [close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={close} />
      <div className="flex min-h-screen items-start justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-[1300px] rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
            <p className="text-[0.8125rem] font-bold text-[var(--ink)]">New Quotation</p>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]"
            >
              Cancel
            </button>
          </div>
          <div className="p-4 max-h-[80vh] overflow-y-auto">
            <NewQuotationForm
              currency={currency}
              canOverrideDiscount={canOverrideDiscount}
              clients={clients}
              leads={leads}
              jobs={jobs}
              parts={parts}
              taxRates={taxRates}
              defaultTaxApplicable={defaultTaxApplicable}
              defaultTaxRate={defaultTaxRate}
              defaultTaxLabel={defaultTaxLabel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuotationNewButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("quotation-create-dialog:open"))}
      className={className ?? "btn-premium rounded-lg px-4 py-2 text-[0.8125rem] font-bold"}
    >
      New Quotation
    </button>
  );
}