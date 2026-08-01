"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { QuotationPreviewDrawer } from "./QuotationPreviewDrawer";

type QuotationPreviewContextType = {
  previewQuotationId: string | null;
  openPreview: (id: string) => void;
  closePreview: () => void;
};

const QuotationPreviewContext = createContext<QuotationPreviewContextType | null>(null);

export function QuotationPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [previewQuotationId, setPreviewQuotationId] = useState<string | null>(null);
  const openPreview = useCallback((id: string) => setPreviewQuotationId(id), []);
  const closePreview = useCallback(() => setPreviewQuotationId(null), []);

  return (
    <QuotationPreviewContext.Provider value={{ previewQuotationId, openPreview, closePreview }}>
      {children}
      <QuotationPreviewDrawer />
    </QuotationPreviewContext.Provider>
  );
}

export function useQuotationPreview() {
  const ctx = useContext(QuotationPreviewContext);
  if (!ctx) throw new Error("useQuotationPreview must be used within QuotationPreviewProvider");
  return ctx;
}
