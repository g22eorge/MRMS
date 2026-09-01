"use client";

import { createContext, useContext, useState } from "react";

type BulkSelectionContextType = {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  pageIds: string[];
  allSelectedOnPage: boolean;
  toggleAllOnPage: () => void;
};

const BulkSelectionContext = createContext<BulkSelectionContextType | null>(null);

export function BulkSelectionProvider({ children, pageIds }: { children: React.ReactNode; pageIds: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // pageIds is used directly, not mirrored into state.
  //
  // It used to be copied into state and re-synced by an effect. Both call sites
  // build the array inline — pageIds={rows.map(r => r.id)} — so it is a new
  // array identity on every render, the effect's dependency always differed,
  // and every parent render cost a second child render for nothing.
  //
  // The correctness problem was the window between them. useEffect runs after
  // paint, so after paging there is a moment where the screen shows page 2
  // while this state still holds page 1's ids — and pageIds drives select-all,
  // deselect-all and the header checkbox. Clicking "select all" in that window
  // selected the previous page's rows, and the bulk action that followed acted
  // on records the user could not see.
  //
  // Derived data does not belong in state; the prop is already the answer.

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clear = () => setSelected(new Set());

  const isSelected = (id: string) => selected.has(id);

  const allSelectedOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleAllOnPage = () => {
    if (allSelectedOnPage) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of pageIds) next.delete(id);
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...pageIds]));
    }
  };

  return (
    <BulkSelectionContext.Provider value={{ selected, toggle, clear, isSelected, pageIds, allSelectedOnPage, toggleAllOnPage }}>
      {children}
    </BulkSelectionContext.Provider>
  );
}

export function useBulkSelection() {
  const ctx = useContext(BulkSelectionContext);
  if (!ctx) throw new Error("useBulkSelection must be used within BulkSelectionProvider");
  return ctx;
}
