import type { ReactNode } from "react";

import { PageEmptyState } from "@/components/page-state";

type DocumentEmptyStateProps = {
  message: string;
  action?: ReactNode;
  className?: string;
};

export function DocumentEmptyState({ message, action, className = "" }: DocumentEmptyStateProps) {
  return <PageEmptyState title={message} action={action} className={className} variant="panel" />;
}

/** Table row empty state — use inside `<tbody>`. */
export function DocumentEmptyTableRow({ message, colSpan }: { message: string; colSpan: number }) {
  return <PageEmptyState title={message} variant="table-row" colSpan={colSpan} />;
}
