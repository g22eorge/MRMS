import type { ReactNode } from "react";

type LineItemsPanelProps = {
  title: string;
  subtitle?: string;
  addLabel?: string;
  onAddLine: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  dense?: boolean;
};

export function LineItemsPanel({
  title,
  subtitle,
  addLabel = "+ Add Line",
  onAddLine,
  children,
  footer,
  className = "",
  dense = false,
}: LineItemsPanelProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] ${className}`}>
      <div className={`flex items-center justify-between border-b border-[var(--line)] ${dense ? "px-3 py-2" : "px-5 py-3"}`}>
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">{title}</p>
          {subtitle ? <p className="text-[0.75rem] text-[var(--ink-muted)]">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onAddLine}
          className="rounded-md bg-[var(--accent)]/15 px-3 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/25"
        >
          {addLabel}
        </button>
      </div>
      <div className="overflow-x-auto">{children}</div>
      {footer}
    </div>
  );
}

export type PartSelectOption = {
  id: string;
  sku: string;
  name: string;
  unitCost?: number | null;
  sellingPrice?: number | null;
  qtyOnHand?: number;
};

type PartSelectProps = {
  value: string;
  parts: PartSelectOption[];
  onChange: (partId: string) => void;
  allowCustom?: boolean;
  customLabel?: string;
  showStock?: boolean;
  showCreateOption?: boolean;
  createOptionLabel?: string;
  className?: string;
};

export function PartSelect({
  value,
  parts,
  onChange,
  allowCustom = true,
  customLabel = "Custom",
  showStock = false,
  showCreateOption = false,
  createOptionLabel = "+ Create new…",
  className = "w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5 text-xs text-[var(--ink)]",
}: PartSelectProps) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={className}>
      {allowCustom ? <option value="">{customLabel}</option> : null}
      {showCreateOption ? <option value="__new__">{createOptionLabel}</option> : null}
      {parts.map((part) => (
        <option key={part.id} value={part.id}>
          {part.name}
          {showStock && part.qtyOnHand != null ? ` (${part.qtyOnHand})` : ""}
        </option>
      ))}
    </select>
  );
}

const inputClass =
  "w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]/50";

export { inputClass as lineItemInputClass };
