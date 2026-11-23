"use client";

import { useActionState } from "react";

import type { ImportResult } from "@/app/(app)/settings/data/actions";

/** One spreadsheet upload, with what happened to each line afterwards. */
export function ImportForm({
  title,
  columns,
  templateHref,
  action,
}: {
  title: string;
  columns: string;
  templateHref: string;
  action: (state: ImportResult, formData: FormData) => Promise<ImportResult>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const skipped = state.skipped ?? [];

  return (
    <section className="dc-card space-y-3 px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
        <a href={templateHref} download className="text-[0.8125rem] font-semibold text-[var(--accent)] hover:underline">
          Download a template
        </a>
      </div>
      <p className="text-[0.8125rem] text-[var(--ink-muted)]">Columns: {columns}</p>

      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[0.8125rem] text-[var(--ink)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--panel)] file:px-2.5 file:py-1 file:text-[0.8125rem] file:font-semibold file:text-[var(--ink)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-premium rounded-lg px-3 py-1.5 text-[0.8125rem] text-white disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[0.8125rem] text-red-500">{state.error}</p>
      ) : null}

      {state.created !== undefined ? (
        <div role="status" className="space-y-2 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5 text-[0.8125rem]">
          <p className="font-semibold text-[var(--ink)]">
            {state.created} added{skipped.length > 0 ? `, ${skipped.length} skipped` : ""}.
          </p>
          {skipped.length > 0 ? (
            <ul className="max-h-48 space-y-0.5 overflow-auto text-[var(--ink-muted)]">
              {skipped.slice(0, 200).map((item) => (
                <li key={`${item.line}-${item.reason}`}>Line {item.line}: {item.reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
