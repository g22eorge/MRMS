"use client";

import { useBulkSelection } from "./BulkSelectionProvider";

export function RowCheckbox({ quotationId }: { quotationId: string }) {
  const { isSelected, toggle } = useBulkSelection();
  const checked = isSelected(quotationId);
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => toggle(quotationId)}
      className="h-4 w-4 rounded border-gray-300"
    />
  );
}
