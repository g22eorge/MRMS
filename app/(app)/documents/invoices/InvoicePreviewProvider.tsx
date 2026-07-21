"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { InvoicePreviewDrawer } from "./InvoicePreviewDrawer";

type InvoicePreviewContextType = {
  previewInvoiceId: string | null;
  openPreview: (id: string) => void;
  closePreview: () => void;
};

const InvoicePreviewContext = createContext<InvoicePreviewContextType | null>(null);

export function InvoicePreviewProvider({ children }: { children: ReactNode }) {
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const openPreview = useCallback((id: string) => setPreviewInvoiceId(id), []);
  const closePreview = useCallback(() => setPreviewInvoiceId(null), []);

  return (
    <InvoicePreviewContext.Provider value={{ previewInvoiceId, openPreview, closePreview }}>
      {children}
      <InvoicePreviewDrawer />
    </InvoicePreviewContext.Provider>
  );
}

export function useInvoicePreview() {
  const ctx = useContext(InvoicePreviewContext);
  if (!ctx) throw new Error("useInvoicePreview must be used within InvoicePreviewProvider");
  return ctx;
}
