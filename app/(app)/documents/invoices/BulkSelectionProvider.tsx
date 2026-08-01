"use client";

import { createContext, useContext, useState, useEffect, useMemo } from "react";

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

export function BulkSelectionProvider({
  children,
  pageIds: initialPageIds,
}: {
  children: React.ReactNode;
  pageIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageIds, setPageIds] = useState<string[]>(initialPageIds);

  useEffect(() => {
    setPageIds(initialPageIds);
  }, [initialPageIds]);

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

  const allSelectedOnPage =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

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
    <BulkSelectionContext.Provider
      value={{
        selected,
        toggle,
        clear,
        isSelected,
        pageIds,
        allSelectedOnPage,
        toggleAllOnPage,
      }}
    >
      {children}
    </BulkSelectionContext.Provider>
  );
}

export function useBulkSelection() {
  const ctx = useContext(BulkSelectionContext);
  if (!ctx) throw new Error("useBulkSelection must be used within provider");
  return ctx;
}
