/**
 * QuotationStages — a visible Draft → Sent → Confirmed → Converted progress
 * stepper driven by the existing QuotationStatus (no schema change). Terminal
 * states (rejected / expired / void) render as a single labelled pill instead.
 */

const STEPS = ["Draft", "Sent", "Confirmed", "Converted"] as const;

export function QuotationStages({ status, converted }: { status: string; converted: boolean }) {
  const terminal =
    status === "REJECTED" ? { label: "Declined", cls: "border-red-400/40 bg-red-500/10 text-red-600 dark:text-red-400" } :
    status === "EXPIRED" ? { label: "Expired", cls: "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-400" } :
    status === "VOID" ? { label: "Void", cls: "border-red-400/40 bg-red-500/10 text-red-600 dark:text-red-400" } :
    null;

  if (terminal) {
    return (
      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-bold ${terminal.cls}`}>
        {terminal.label}
      </span>
    );
  }

  // Index of the furthest reached stage.
  const reached = converted ? 3 : status === "ACCEPTED" ? 2 : status === "SENT" ? 1 : 0;

  return (
    <ol className="flex items-center gap-1 overflow-x-auto">
      {STEPS.map((label, i) => {
        const done = i < reached;
        const current = i === reached;
        return (
          <li key={label} className="flex shrink-0 items-center gap-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                done
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/12 text-[var(--accent)]"
                  : current
                    ? "border-transparent bg-[var(--accent)] text-black"
                    : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
              }`}
            >
              <span
                className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-black ${
                  done ? "bg-[var(--accent)] text-black" : current ? "bg-black/20 text-black" : "bg-[var(--line)] text-[var(--ink-muted)]"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className={`h-px w-4 shrink-0 ${i < reached ? "bg-[var(--accent)]/50" : "bg-[var(--line)]"}`} aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
