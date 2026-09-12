"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PartOption = {
  id: string;
  sku: string;
  name: string;
  sellingPrice?: number | null;
  unitCost?: number | null;
  qtyOnHand?: number | null;
};

/**
 * A description field that can pull a line from inventory.
 *
 * The create dialog has had an inventory picker for a long time; the edit view
 * never did — its line items were plain text inputs with no parts query and no
 * partId anywhere on the page. So a quote built from stock lost the link to
 * stock the moment anyone edited it, and with it the cost and quantity behind
 * the line. Typing the name again produces a line that reads the same and knows
 * nothing.
 *
 * Written to drop into the existing per-item server-action forms rather than
 * replacing them with a client-side table: it owns only its own description and
 * partId, and reaches sideways for the price field by name, which is the one
 * thing selecting a part should also fill in.
 *
 * The list is anchored to the input's viewport rect and portaled to
 * document.body. It cannot be an absolutely-positioned child: these forms sit
 * inside cards and tables that clip, which is the same reason the picker in the
 * quotation dialog had to be portaled.
 */
export function PartPickerField({
  parts,
  name = "description",
  partIdName = "partId",
  priceFieldName = "unitPrice",
  defaultValue = "",
  defaultPartId = "",
  required = false,
  placeholder = "Type a product or service — or pick from inventory",
  className = "",
  formId,
}: {
  parts: PartOption[];
  name?: string;
  partIdName?: string;
  /** Associate the inputs with a form by id instead of by nesting. */
  formId?: string;
  /** Sibling input in the same form to fill with the part's price on select. */
  priceFieldName?: string;
  defaultValue?: string;
  defaultPartId?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(defaultValue);
  const [partId, setPartId] = useState(defaultPartId);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const position = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    position();
    // Capture phase so the card and dialog scrollers count, not just the window.
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open, position]);

  const q = text.trim().toLowerCase();
  const matches = (q ? parts.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(q)) : parts).slice(0, 6);

  function choose(part: PartOption) {
    setText(part.name);
    setPartId(part.id);
    setOpen(false);
    // Selecting a part should price the line too. The price input belongs to the
    // same form and is rendered by the page, so it is reached by name rather
    // than lifted into this component and changing every caller's layout.
    const price = part.sellingPrice ?? part.unitCost;
    if (price != null && inputRef.current) {
      // .form, not closest("form"): these inputs may be associated with a form
      // by id rather than nested inside it, and closest() only walks ancestors.
      const form = inputRef.current.form;
      const field = form?.elements.namedItem(priceFieldName);
      if (field instanceof HTMLInputElement) {
        field.value = String(price);
      }
    }
  }

  return (
    <>
      <input type="hidden" name={partIdName} value={partId} form={formId} />
      <input
        ref={inputRef}
        name={name}
        form={formId}
        required={required}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          // Typing over a chosen part breaks the link: the line is now whatever
          // was typed, and pretending it is still that stock item would be a lie
          // on the invoice and in the stock ledger.
          setPartId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className={className || "mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50"}
      />
      {open && rect && matches.length > 0 && typeof document !== "undefined"
        ? createPortal(
            <div
              style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
              className="z-[60] max-h-56 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1 shadow-lg"
            >
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(p)}
                  className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-[0.8125rem] hover:bg-[var(--panel-strong)]"
                >
                  <span className="font-semibold text-[var(--ink)]">{p.name}</span>
                  <span className="text-[var(--ink-muted)]">
                    {" · "}{p.sku}{p.qtyOnHand != null ? ` (${p.qtyOnHand})` : ""}
                  </span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
