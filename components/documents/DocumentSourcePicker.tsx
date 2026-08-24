"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SourceOption = {
  /** Posted form value, e.g. "invoice:abc123". */
  value: string;
  /** What the user reads: customer first, then the reference. */
  label: string;
  /** Optional second line — amount, date, whatever helps pick the right one. */
  hint?: string;
  /**
   * Everything this row should be findable by: customer name, phone, document
   * number, job number. Matched as lowercase substrings, all terms must hit.
   */
  search: string;
};

export type SourceGroup = { label: string; options: SourceOption[] };

/**
 * Searchable picker for "which document is this for?".
 *
 * These lists were plain <select> elements capped at 50-80 rows, so finding a
 * customer meant scrolling a dropdown of document numbers — and a job-linked
 * invoice was labelled with its JOB number rather than the customer's name, so
 * the name you were looking for often wasn't on screen at all. Typing any part
 * of a customer name, phone, invoice number, sale number or job number now
 * narrows the list.
 *
 * Posts through a hidden input so the form contract is unchanged: the server
 * action still receives `sourceKey` (or whatever `name` is passed).
 */
export function DocumentSourcePicker({
  name,
  groups,
  placeholder = "Search by customer, number or job…",
  emptyLabel = "No matching documents",
  required,
  id,
  defaultValue,
  onSelect,
}: {
  name: string;
  groups: SourceGroup[];
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  id?: string;
  /** Preselect a row (by its `value`). */
  defaultValue?: string;
  /** Notified when the choice changes, for pickers that drive the rest of a form. */
  onSelect?: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SourceOption | null>(
    () => groups.flatMap((g) => g.options).find((o) => o.value === defaultValue) ?? null,
  );
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return groups;
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => {
          const hay = `${o.label} ${o.hint ?? ""} ${o.search}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        }),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  const flat = useMemo(() => filtered.flatMap((g) => g.options), [filtered]);

  // Keep the highlighted row inside the filtered list as it shrinks.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (o: SourceOption) => {
    setSelected(o);
    setQuery("");
    setOpen(false);
    onSelect?.(o.value);
  };

  const fieldClass =
    "h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input type="hidden" name={name} value={selected?.value ?? ""} required={required} />

      {selected ? (
        <div className={`${fieldClass} flex items-center justify-between gap-2`}>
          <span className="truncate">{selected.label}</span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setOpen(true);
            }}
            className="shrink-0 text-[0.75rem] font-semibold text-[var(--ink-muted)] underline hover:text-[var(--ink)]"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${name}-listbox`}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          className={fieldClass}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, flat.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              if (open && flat[active]) {
                e.preventDefault();
                choose(flat[active]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      )}

      {open && !selected ? (
        <div
          id={`${name}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-lg"
        >
          {flat.length === 0 ? (
            <p className="px-3 py-2.5 text-[0.8125rem] text-[var(--ink-muted)]">{emptyLabel}</p>
          ) : (
            filtered.map((g) => (
              <div key={g.label}>
                <p className="sticky top-0 bg-[var(--panel-strong)] px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                  {g.label}
                </p>
                {g.options.map((o) => {
                  const idx = flat.indexOf(o);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={idx === active}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => choose(o)}
                      className={`block w-full px-3 py-2 text-left text-[0.8125rem] ${
                        idx === active ? "bg-[var(--accent)]/10" : ""
                      }`}
                    >
                      <span className="block truncate text-[var(--ink)]">{o.label}</span>
                      {o.hint ? (
                        <span className="block truncate text-[0.75rem] text-[var(--ink-muted)] tabular-nums">{o.hint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
