"use client";

import { useMemo, useState, type FormEvent, useEffect } from "react";

import {
  CommercialLineItemsEditor,
  CustomerPicker,
  LineItemTotals,
  TaxToggleField,
  useCustomerPicker,
} from "@/components/forms";
import { useLineItemsState } from "@/hooks/useLineItemsState";
import { commercialLineTotal, emptyCommercialLineItem } from "@/lib/forms/line-items";

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
  action: (formData: FormData) => Promise<void>;
  clients: Array<{
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    organization: string | null;
    address: string | null;
  }>;
  parts: PartOption[];
  taxRates: TaxRateOption[];
  currency: string;
  canOverrideDiscount: boolean;
  defaultTaxApplicable: boolean;
  defaultTaxRate: number;
  defaultTaxLabel: string;
  leads?: any[];
  jobs?: any[];
  initialData?: {
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
  submitLabel?: string;
};

export function CreateStandaloneInvoiceForm({
  action,
  clients,
  parts,
  taxRates,
  currency,
  canOverrideDiscount,
  defaultTaxApplicable,
  defaultTaxRate,
  defaultTaxLabel,
  initialData,
  submitLabel = "Create Invoice",
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const customer = useCustomerPicker(clients);
  const { lines, addLine, removeLine, updateLine, serialize, replaceLines } = useLineItemsState(emptyCommercialLineItem);
  const [taxEnabled, setTaxEnabled] = useState(defaultTaxApplicable);
  const [partsList, setPartsList] = useState<PartOption[]>(parts);

  // Seed from initialData when available (edit mode)
  useEffect(() => {
    if (initialData?.clientId) customer.setSelectedClientId(initialData.clientId);
  }, [initialData?.clientId]);

  useEffect(() => {
    if (initialData?.lines?.length) {
      // @ts-ignore - seeded from edit-initialData (optional fields coerced)
      replaceLines(initialData.lines.map((line) => ({
        ...emptyCommercialLineItem,
        ...line,
      })));
    }
  }, []);

  async function handleCreatePart(data: { sku: string; name: string; unitCost?: number | null; qtyOnHand?: number }) {
    const res = await fetch("/api/parts/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create part");
    const newPart = (await res.json()) as PartOption;
    setPartsList((prev) => [...prev, newPart]);
    return newPart;
  }

  const initialTaxKey = taxRates.find((rate) => rate.isDefault)?.id
    ? `rate:${taxRates.find((rate) => rate.isDefault)?.id}`
    : taxRates[0]?.id
    ? taxRates[0].id
    : "branding";
  const [selectedTaxKey, setSelectedTaxKey] = useState(initialTaxKey);

  const taxOptions = useMemo(() => {
    const rates = taxRates.map((rate) => ({
      key: `rate:${rate.id}`,
      label: `${rate.code} - ${rate.rate}%`,
      taxLabel: rate.code,
      taxRate: rate.rate,
    }));
    if (rates.length) return rates;
    return [
      {
        key: "branding",
        label: `${defaultTaxLabel || "VAT"} - ${Number(defaultTaxRate) || 0}%`,
        taxLabel: defaultTaxLabel || "VAT",
        taxRate: Number(defaultTaxRate) || 0,
      },
    ];
  }, [defaultTaxLabel, defaultTaxRate, taxRates]);
  const selectedTax = taxOptions.find((option) => option.key === selectedTaxKey) ?? taxOptions[0];

  function selectPart(key: number, partId: string, partObj?: PartOption) {
    const part = partObj ?? partsList.find((item) => item.id === partId);
    updateLine(key, {
      partId,
      description: part ? `${part.sku} · ${part.name}` : "",
      unitPrice: part?.unitCost ?? 0,
    });
  }

  const subtotal = lines.reduce((sum, item) => sum + commercialLineTotal(item, canOverrideDiscount), 0);
  const taxRate = taxEnabled ? Math.max(0, Number(selectedTax?.taxRate ?? 0)) : 0;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  function formatAmount(value: number) {
    const zeroDecimal = new Set(["UGX", "JPY", "KRW"]).has(currency);
    return `${currency} ${value.toLocaleString("en-US", {
      minimumFractionDigits: zeroDecimal ? 0 : 2,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
    })}`;
  }

  function validateSubmit(event: FormEvent<HTMLFormElement>) {
    if (customer.mode === "existing" && !customer.selectedClient) {
      event.preventDefault();
      setError("Select a client or switch to new client.");
      return;
    }
    if (customer.mode === "new" && (!customer.newClient.fullName.trim() || !customer.newClient.phone.trim())) {
      event.preventDefault();
      setError("Enter the new client's name and phone number.");
      return;
    }
    const validItems = lines.filter((item) => item.description.trim() && item.quantity > 0 && item.unitPrice >= 0);
    if (!validItems.length) {
      event.preventDefault();
      setError("Add at least one product or service line.");
      return;
    }
    setError(null);
  }

  const serializedItems = serialize((item) => ({
    partId: item.partId || null,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: canOverrideDiscount ? item.discount : 0,
  })).filter((item) => item.description.trim() && item.quantity > 0 && item.unitPrice >= 0);

  return (
  <section className="overflow-hidden rounded-xl bg-[var(--panel)]">
    <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
      <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Create Invoice</h2>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("invoice-create-dialog:close"))}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--accent)]"
        aria-label="Close"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <form action={action} onSubmit={validateSubmit} className="max-h-[calc(100vh-120px)] overflow-y-auto" style={{ height: "calc(100vh - 160px)" }}>
        {error ? (
          <div className="mx-4 mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : null}

        <input type="hidden" name="clientId" value={customer.mode === "existing" ? customer.selectedClient?.id ?? "" : ""} />
        <input type="hidden" name="newClientFullName" value={customer.mode === "new" ? customer.newClient.fullName : ""} />
        <input type="hidden" name="newClientPhone" value={customer.mode === "new" ? customer.newClient.phone : ""} />
        <input type="hidden" name="newClientEmail" value={customer.mode === "new" ? customer.newClient.email : ""} />
        <input type="hidden" name="newClientOrganization" value={customer.mode === "new" ? customer.newClient.organization : ""} />
        <input type="hidden" name="newClientAddress" value={customer.mode === "new" ? customer.newClient.address : ""} />
        <input type="hidden" name="items" value={JSON.stringify(serializedItems)} />
        <input type="hidden" name="taxApplicable" value={taxEnabled ? "1" : "0"} />
        <input type="hidden" name="taxRate" value={taxRate} />
        <input type="hidden" name="taxLabel" value={taxEnabled ? selectedTax?.taxLabel ?? "Tax" : ""} />
        <input type="hidden" name="currency" value={currency} />

        <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_260px]">
          <div className="divide-y divide-[var(--line)]">
            <div className="p-4">
              <CustomerPicker
                clients={clients}
                mode={customer.mode}
                onModeChange={customer.setMode}
                query={customer.query}
                onQueryChange={customer.setQuery}
                selectedClientId={customer.selectedClientId}
                onSelectClient={customer.setSelectedClientId}
                newClient={customer.newClient}
                onNewClientChange={customer.patchNewClient}
              />
            </div>

            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Line Items</p>
              </div>
              <CommercialLineItemsEditor
                items={lines}
                parts={partsList.map((part) => ({ ...part, unitCost: part.unitCost, qtyOnHand: part.qtyOnHand }))}
                canOverrideDiscount={canOverrideDiscount}
                formatAmount={formatAmount}
                onAddLine={addLine}
                onRemoveLine={removeLine}
                onUpdateLine={updateLine}
                onSelectPart={selectPart}
                onCreatePart={handleCreatePart}
              />
            </div>

            <div className="p-4">
              <div className="grid grid-cols-2 gap-2">
        <select name="invoiceType" defaultValue={initialData?.invoiceType ?? "SERVICE"} className="h-9 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50">
          {["SERVICE", "MERCHANDISE", "CONTRACT", "OTHER"].map((type) => (
            <option key={type} value={type}>
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <input name="subject" placeholder="Subject" defaultValue={initialData?.subject ?? ""} className="h-9 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
        <input name="dueDate" type="date" defaultValue={initialData?.dueDate ?? ""} className="h-9 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
        <input name="notes" placeholder="Notes or payment terms" defaultValue={initialData?.notes ?? ""} className="h-9 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--line)] bg-[var(--panel-strong)] p-4 min-[900px]:border-t-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Totals</p>
                <TaxToggleField enabled={taxEnabled} onChange={setTaxEnabled} label="Tax" />
              </div>
              {taxEnabled ? (
                <select value={selectedTaxKey} onChange={(event) => setSelectedTaxKey(event.target.value)} className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50">
                  {taxOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              ) : null}
              <LineItemTotals
                currency={currency}
                formatMoney={formatAmount}
                subtotal={subtotal}
                taxLabel={taxEnabled ? `${selectedTax?.taxLabel ?? "Tax"} (${taxRate}%)` : "Tax"}
                taxAmount={taxAmount}
                total={totalAmount}
              />
              <div className="space-y-2">
                <button type="submit" className="btn-premium w-full rounded-lg px-4 py-2.5 text-sm font-bold">{submitLabel}</button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
