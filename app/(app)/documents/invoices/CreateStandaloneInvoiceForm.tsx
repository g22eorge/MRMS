"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { CommercialLineItemsEditor, CustomerPicker, LineItemTotals, TaxToggleField, useCustomerPicker } from "@/components/forms";
import { useLineItemsState } from "@/hooks/useLineItemsState";
import { commercialLineTotal, emptyCommercialLineItem } from "@/lib/forms/line-items";

type PartOption = {
  id: string;
  sku: string;
  name: string;
  unitCost: number | null;
  qtyOnHand: number;
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
  createMode: boolean;
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
};

export function CreateStandaloneInvoiceForm({
  action,
  createMode,
  clients,
  parts,
  taxRates,
  currency,
  canOverrideDiscount,
  defaultTaxApplicable,
  defaultTaxRate,
  defaultTaxLabel,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const customer = useCustomerPicker(clients);
  const { lines, addLine, removeLine, updateLine, serialize } = useLineItemsState(emptyCommercialLineItem);
  const [taxEnabled, setTaxEnabled] = useState(defaultTaxApplicable);
  const initialTaxKey = taxRates.find((rate) => rate.isDefault)?.id
    ? `rate:${taxRates.find((rate) => rate.isDefault)?.id}`
    : taxRates[0]?.id
      ? `rate:${taxRates[0].id}`
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
    return [{
      key: "branding",
      label: `${defaultTaxLabel || "VAT"} - ${Number(defaultTaxRate) || 0}%`,
      taxLabel: defaultTaxLabel || "VAT",
      taxRate: Number(defaultTaxRate) || 0,
    }];
  }, [defaultTaxLabel, defaultTaxRate, taxRates]);
  const selectedTax = taxOptions.find((option) => option.key === selectedTaxKey) ?? taxOptions[0];

  function selectPart(key: number, partId: string) {
    const part = parts.find((item) => item.id === partId);
    updateLine(key, {
      partId,
      description: part ? `${part.sku} - ${part.name}` : "",
      unitPrice: part?.unitCost ?? 0,
    });
  }

  const validItems = lines.filter((item) => item.description.trim() && item.quantity > 0 && item.unitPrice >= 0);
  const subtotal = lines.reduce((sum, item) => sum + commercialLineTotal(item, canOverrideDiscount), 0);
  const productLines = lines.filter((item) => item.partId).length;
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
    <details
      id="create-invoice"
      open={createMode}
      className={`group rounded-xl border border-[var(--line)] bg-[var(--panel)] ${createMode ? "" : "hidden lg:block"}`}
    >
      <summary className="cursor-pointer select-none px-4 py-2.5 text-[12px] font-semibold text-[var(--ink)] group-open:border-b group-open:border-[var(--line)]">
        + Create Invoice
      </summary>
      <form action={action} onSubmit={validateSubmit} className="space-y-3 p-3">
        {error ? <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div> : null}

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

        <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.45fr)]">
          <div className="space-y-3">
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

            <section className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Details</p>
              <div className="mt-2 grid gap-2">
                <select name="invoiceType" defaultValue="SERVICE" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm">
                  {["SERVICE", "MERCHANDISE", "CONTRACT", "OTHER"].map((type) => (
                    <option key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</option>
                  ))}
                </select>
                <input name="subject" placeholder="Subject / description" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:border-[var(--accent)]/50" />
                <input name="dueDate" type="date" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:border-[var(--accent)]/50" />
                <input name="notes" placeholder="Notes or payment terms" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:border-[var(--accent)]/50" />
              </div>
            </section>

            <section className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Totals</p>
                <TaxToggleField enabled={taxEnabled} onChange={setTaxEnabled} label="Tax" />
              </div>
              {taxEnabled ? (
                <select value={selectedTaxKey} onChange={(event) => setSelectedTaxKey(event.target.value)} className="mt-2 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm">
                  {taxOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              ) : null}
              <LineItemTotals
                className="mt-3"
                currency={currency}
                formatMoney={formatAmount}
                leadingRows={[
                  { label: "Lines", value: <>{validItems.length}/{lines.length}</> },
                  { label: "Products", value: productLines },
                ]}
                subtotal={subtotal}
                taxLabel={taxEnabled ? `${selectedTax?.taxLabel ?? "Tax"} (${taxRate}%)` : "Tax"}
                taxAmount={taxAmount}
                total={totalAmount}
              />
            </section>
          </div>

          <CommercialLineItemsEditor
            items={lines}
            parts={parts.map((part) => ({ ...part, unitCost: part.unitCost, qtyOnHand: part.qtyOnHand }))}
            canOverrideDiscount={canOverrideDiscount}
            formatAmount={formatAmount}
            onAddLine={addLine}
            onRemoveLine={removeLine}
            onUpdateLine={updateLine}
            onSelectPart={selectPart}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-premium rounded-lg px-5 py-2 text-[13px] font-bold">Create Invoice</button>
          <Link href="/documents/invoices" className="rounded-lg border border-[var(--line)] px-5 py-2 text-[13px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">Cancel</Link>
        </div>
      </form>
    </details>
  );
}
