"use client";

import { useBulkSelection } from "./BulkSelectionProvider";

export function RowCheckbox({ invoiceId }: { invoiceId: string }) {
  const { isSelected, toggle } = useBulkSelection();
  const checked = isSelected(invoiceId);
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => toggle(invoiceId)}
      className="h-4 w-4 rounded border-gray-300"
    />
  );
}
