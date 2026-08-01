import type { ReactNode } from "react";

type PageEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "panel" | "dashed" | "table-row";
  colSpan?: number;
  className?: string;
};

export function PageEmptyState({
  title,
  description,
  action,
  variant = "panel",
  colSpan,
  className = "",
}: PageEmptyStateProps) {
  if (variant === "table-row") {
    return (
      <tr className="border-t border-[var(--line)]">
        <td className="px-3 py-8 text-sm text-[var(--ink-muted)]" colSpan={colSpan ?? 1}>
          <p className="font-medium text-[var(--ink)]">{title}</p>
          {description ? <p className="mt-1">{description}</p> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </td>
      </tr>
    );
  }

  const shellClass =
    variant === "dashed"
      ? "rounded-xl border border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5 px-6 py-8 text-center"
      : "rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-8 text-center text-sm text-[var(--ink-muted)]";

  return (
    <div className={`${shellClass} ${className}`}>
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      {description ? <p className="mt-1 text-xs text-[var(--ink-muted)]">{description}</p> : null}
      {action ? <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
