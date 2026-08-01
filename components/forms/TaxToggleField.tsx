"use client";

import { CheckboxField } from "./CheckboxField";

export interface TaxToggleFieldProps {
  /** Whether tax is currently applied. */
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  /** Optional tax rate (percent) appended to the label, e.g. "VAT applicable (18%)". */
  rate?: number;
  /** Toggle label. Defaults to "Tax applicable". */
  label?: string;
  disabled?: boolean;
  /** Whether the checkbox renders before or after the label. Defaults to "trailing". */
  checkboxPosition?: "leading" | "trailing";
  /** Class for the wrapping <label> row. */
  className?: string;
}

/** Standardized "Tax/VAT applicable" toggle built on CheckboxField. */
export function TaxToggleField({
  enabled,
  onChange,
  rate,
  label = "Tax applicable",
  disabled,
  checkboxPosition = "trailing",
  className,
}: TaxToggleFieldProps) {
  return (
    <CheckboxField
      label={rate !== undefined ? `${label} (${rate}%)` : label}
      checked={enabled}
      onChange={onChange}
      disabled={disabled}
      checkboxPosition={checkboxPosition}
      className={className}
    />
  );
}
