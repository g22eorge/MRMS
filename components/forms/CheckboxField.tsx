"use client";

import type { ReactNode } from "react";

const checkboxBase = "h-4 w-4 rounded border-[var(--line)] accent-[var(--accent)]";
const labelDefault = "flex items-center gap-2 text-xs font-semibold text-[var(--ink)]";

export interface CheckboxFieldProps {
  /**
   * Label content. Omit to render a bare checkbox (no <label> wrapper) — useful
   * when the checkbox lives inside a larger clickable row.
   */
  label?: ReactNode;
  /** Optional muted helper text rendered under the label. */
  description?: ReactNode;
  /** Controlled usage (client forms). */
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Uncontrolled / server-action usage. */
  name?: string;
  defaultChecked?: boolean;
  /** Submitted value when checked. Defaults to "true". */
  value?: string;
  /**
   * Server-action idiom: also render <input type="hidden" name={name} value="false" />
   * immediately AFTER the checkbox, so FormData.get(name) yields "true" when checked
   * (checkbox entry wins) and "false" when unchecked (hidden entry remains).
   */
  withHiddenFalse?: boolean;
  disabled?: boolean;
  /** Whether the checkbox renders before ("leading", default) or after ("trailing") the label. */
  checkboxPosition?: "leading" | "trailing";
  /** Class for the wrapping <label> row. Defaults to the app's standard checkbox row. */
  className?: string;
  /** Extra classes appended to the standard checkbox input styling. */
  inputClassName?: string;
}

export function CheckboxField({
  label,
  description,
  checked,
  onChange,
  name,
  defaultChecked,
  value = "true",
  withHiddenFalse = false,
  disabled,
  checkboxPosition = "leading",
  className,
  inputClassName,
}: CheckboxFieldProps) {
  const box = (
    <>
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        disabled={disabled}
        className={`${checkboxBase}${inputClassName ? ` ${inputClassName}` : ""}`}
      />
      {withHiddenFalse && name ? <input type="hidden" name={name} value="false" /> : null}
    </>
  );

  if (label === undefined && description === undefined) {
    return box;
  }

  const text = description ? (
    <span className="min-w-0">
      <span className="block">{label}</span>
      <span className="block text-[11px] font-normal text-[var(--ink-muted)]">{description}</span>
    </span>
  ) : (
    <span>{label}</span>
  );

  return (
    <label className={className ?? labelDefault}>
      {checkboxPosition === "trailing" ? (
        <>
          {text}
          {box}
        </>
      ) : (
        <>
          {box}
          {text}
        </>
      )}
    </label>
  );
}
