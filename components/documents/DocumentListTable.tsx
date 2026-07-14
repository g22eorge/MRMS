import type { ReactNode } from "react";

type DocumentListTableProps = {
  children: ReactNode;
  className?: string;
};

/** Shared wrapper for document list tables (desktop). */
export function DocumentListTable({ children, className = "" }: DocumentListTableProps) {
  return (
    <div className={`doc-list overflow-x-auto rounded-xl border border-[var(--line)] ${className}`}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function DocumentListTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-[var(--panel-strong)] text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
      {children}
    </thead>
  );
}
