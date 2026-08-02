"use client";

import { useEffect, useState, useCallback } from "react";
import { CreateStandaloneInvoiceForm } from "./CreateStandaloneInvoiceForm";

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
  email: string | null;
  organization: string | null;
  interest: string | null;
};

type JobOption = {
  id: string;
  jobNumber: string;
  brand: string | null;
  model: string | null;
  client: { fullName: string; phone: string | null; address: string | null } | null;
};

type PartOption = {
  id: string;
  sku: string;
  name: string;
  unitCost?: number | null;
  qtyOnHand?: number;
};

type TaxRateOption = {
  id: string;
  name: string;
  code: string;
  rate: number;
  isDefault: boolean;
};

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
  action: (formData: FormData) => Promise<void>;
  editInvoiceId?: string;
  editInitialData?: {
    clientId?: string;
    invoiceType?: string;
    subject?: string;
    dueDate?: string;
    notes?: string;
    taxEnabled?: boolean;
    taxRate?: number;
    taxLabel?: string;
    lines?: Array<{
      description?: string;
      quantity?: number;
      unitPrice?: number;
      discount?: number;
    }>;
  };
};

export function InvoiceCreateDialog({
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
  action,
  editInvoiceId,
  editInitialData,
}: Props) {
  const [open, setOpen] = useState(Boolean(editInvoiceId));

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const opener = () => setOpen(true);
    const closer = () => close();
    window.addEventListener("invoice-create-dialog:open", opener);
    window.addEventListener("invoice-create-dialog:close", closer);
    return () => {
      window.removeEventListener("invoice-create-dialog:open", opener);
      window.removeEventListener("invoice-create-dialog:close", closer);
    };
  }, [close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={close} />
      <div className="flex min-h-screen items-start justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-[1300px] rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
            <p className="text-[13px] font-bold text-[var(--ink)]">{editInvoiceId ? "Edit Invoice" : "New Invoice"}</p>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]"
            >
              Cancel
            </button>
          </div>
          <div className="p-4 max-h-[80vh] overflow-y-auto">
      <CreateStandaloneInvoiceForm
        action={action}
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
        initialData={editInitialData}
        editInvoiceId={editInvoiceId}
        submitLabel={editInvoiceId ? "Save changes" : "Create Invoice"}
      />
          </div>
        </div>
      </div>
    </div>
  );
}

export function InvoiceNewButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("invoice-create-dialog:open"))}
      className={className ?? "btn-premium rounded-lg px-4 py-2 text-[13px] font-bold"}
    >
      + New Invoice
    </button>
  );
}
