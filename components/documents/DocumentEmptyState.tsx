import type { ReactNode } from "react";

type DocumentEmptyStateProps = {
  message: string;
  action?: ReactNode;
  className?: string;
};

export function DocumentEmptyState({ message, action, className = "" }: DocumentEmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-8 text-center text-sm text-[var(--ink-muted)] ${className}`}
    >
      <p>{message}</p>
      {action ? <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Table row empty state — use inside `<tbody>`. */
export function DocumentEmptyTableRow({ message, colSpan }: { message: string; colSpan: number }) {
  return (
    <tr className="border-t border-[var(--line)]">
      <td className="px-3 py-8 text-sm text-[var(--ink-muted)]" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}
