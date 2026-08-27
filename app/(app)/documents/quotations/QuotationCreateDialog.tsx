"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { NewQuotationForm } from "@/app/(app)/sales/quotations/new/NewQuotationForm";

/**
 * The button and the dialog sit far apart in the page tree, so they used to
 * talk over a window CustomEvent. That works only while both are hydrated: if
 * anything upstream fails to hydrate, the button still paints, the click
 * dispatches into an empty room, and nothing happens at all — no dialog, no
 * request, nothing to see in a server log. Shared React state fails honestly
 * instead, and a button rendered outside the provider throws immediately
 * rather than silently doing nothing.
 */
type QuotationCreateContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const QuotationCreateContext = createContext<QuotationCreateContextValue | null>(null);

function useQuotationCreate(): QuotationCreateContextValue {
  const ctx = useContext(QuotationCreateContext);
  if (!ctx) {
    throw new Error(
      "QuotationNewButton/QuotationCreateDialog must be rendered inside <QuotationCreateProvider>.",
    );
  }
  return ctx;
}

export function QuotationCreateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return <QuotationCreateContext.Provider value={value}>{children}</QuotationCreateContext.Provider>;
}

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
  client: { fullName: string; phone: string | null; address: string | null; organization: string | null } | null;
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
  const { isOpen, close } = useQuotationCreate();

  // The dialog must escape <main>, which carries `fade-in`:
  //   animation: fade-in-up 340ms ... both;  to { transform: translateY(0) }
  // `fill-mode: both` keeps that transform applied for the life of the page, and
  // a transformed element becomes the containing block for its position:fixed
  // descendants. Rendered in place, "fixed inset-0" therefore covered only the
  // content column — the dialog appeared squeezed behind its own backdrop with
  // the sidebar untouched, rather than centred over the viewport. A portal to
  // document.body puts it outside that containing block.
  // Escape closes it, as a modal should. The old event version had no key
  // handling; the listener is cheap and only bound while the dialog is up.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // No mounted-flag dance is needed: the dialog only opens from a click, so by
  // the time this renders anything the document exists. The guard is for the
  // server pass, where isOpen is false anyway.
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
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
    </div>,
    document.body,
  );
}

export function QuotationNewButton({ className }: { className?: string }) {
  const { open } = useQuotationCreate();
  return (
    <button
      type="button"
      onClick={open}
      className={className ?? "btn-premium rounded-lg px-4 py-2 text-[0.8125rem] font-bold"}
    >
      New Quotation
    </button>
  );
}