"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/currency";

type PickerPart = {
  id: string;
  name: string;
  qtyOnHand: number;
  sellingPrice: number | null;
};

/**
 * Product / description / qty / price fields for the POS add-item bar.
 *
 * Picking a product fills the price with its selling price, which is the
 * MINIMUM for that line: staff can raise it (negotiated upsell) but not lower
 * it. The same rule is enforced in addItemAction on the server, so this is for
 * immediate feedback, not the actual guard.
 */
export function PosAddItemFields({ parts, currency, fieldClass }: { parts: PickerPart[]; currency: string; fieldClass: string }) {
  const [partId, setPartId] = useState("");
  const [price, setPrice] = useState("");

  const part = parts.find((p) => p.id === partId) ?? null;
  const floor = part?.sellingPrice ?? null;
  const priceNum = price.trim() === "" ? null : Number(price);
  const belowFloor = floor != null && priceNum != null && Number.isFinite(priceNum) && priceNum < floor;

  return (
    <>
      <select
        name="partId"
        value={partId}
        aria-label="Product"
        title="Optional: pick a product to deduct stock"
        className={fieldClass}
        onChange={(e) => {
          const next = e.target.value;
          setPartId(next);
          const chosen = parts.find((p) => p.id === next);
          // Selling price becomes the starting (and minimum) price for the line.
          setPrice(chosen?.sellingPrice != null ? String(chosen.sellingPrice) : "");
        }}
      >
        <option value="">Custom item</option>
        {parts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.qtyOnHand})
          </option>
        ))}
      </select>

      <input name="description" placeholder="Description" className={fieldClass} />
      <input name="quantity" placeholder="Qty" defaultValue={1} inputMode="numeric" aria-label="Quantity" className={fieldClass} required />

      <div className="min-w-0">
        <input
          name="unitPrice"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={floor != null ? String(floor) : "Price"}
          inputMode="decimal"
          type="number"
          min={floor ?? 0}
          step="any"
          aria-label="Unit price"
          aria-invalid={belowFloor || undefined}
          className={`${fieldClass} ${belowFloor ? "border-red-500/60 focus:border-red-500/70 focus:ring-red-500/15" : ""}`}
        />
        {floor != null ? (
          <p className={`mt-0.5 text-[0.6875rem] tabular-nums ${belowFloor ? "text-red-500" : "text-[var(--ink-muted)]/80"}`}>
            {belowFloor ? `Below the minimum of ${formatMoney(floor, currency)}` : `min ${formatMoney(floor, currency)}`}
          </p>
        ) : null}
      </div>
    </>
  );
}
