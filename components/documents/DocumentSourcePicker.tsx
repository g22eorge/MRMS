"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

/** The list's own ceiling, where the `max-h-72` class used to be. */
const LIST_MAX_HEIGHT = 288;
/** Breathing room kept between the list and the window edge. */
const EDGE_MARGIN = 8;
/** Distance kept between the input and the list under it. */
const GAP = 4;

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
 *
 * The dropdown is portaled to document.body and positioned with
 * `position: fixed`. It cannot be an absolutely-positioned child of the root
 * div: the picker is used inside modal panels and cards that declare
 * `overflow-hidden` (the modal panel className from modalPanelClassName, and the
 * `dc-card overflow-hidden` pattern), which would clip an absolute child and
 * hide the list the moment it grows past the input.
 *
 * Being fixed also means the list is anchored to the window, so it is capped to
 * the room left in the direction it opens and flips above the input when there
 * is none below — a list hanging past the bottom edge is unreachable, since
 * neither the page nor the list's own scrollbar can bring it back.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

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
    const position = () => {
      const el = inputRef.current ?? rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - GAP - EDGE_MARGIN;
      const above = r.top - GAP - EDGE_MARGIN;
      // Open upward only when the list does not fit below *and* has more room
      // above. The list is `position: fixed`, so anything hanging past the bottom
      // edge is out of reach for good: neither the page nor the list's own
      // scrollbar can carry content that sits outside the window.
      const openUp = below < Math.min(LIST_MAX_HEIGHT, above);
      const available = openUp ? above : below;
      const maxHeight = Math.max(120, Math.min(LIST_MAX_HEIGHT, available));
      setPos({
        // Clamped like the row menu's Math.max(MARGIN, ...): when even the
        // 120px floor does not fit above the input, anchoring by the raw
        // subtraction would push the list's top edge past the top of the
        // window — the defect this cap exists to prevent, mirrored.
        top: Math.max(EDGE_MARGIN, openUp ? r.top - GAP - maxHeight : r.bottom + GAP),
        left: r.left,
        width: r.width,
        maxHeight,
      });
    };
    position();
    // Capture phase so card/dialog scrollers count, not just the window.
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    const onDown = (e: MouseEvent) => {
      if (
        rootRef.current &&
        dropdownRef.current &&
        !rootRef.current.contains(e.target as Node) &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open]);

  function choose(o: SourceOption) {
    setSelected(o);
    setOpen(false);
    setQuery("");
    onSelect?.(o.value);
  }

  const fieldClass =
    "h-9 w-full cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-[0.8125rem] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/20";

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
          ref={inputRef}
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

      {open && !selected && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              id={`${name}-listbox`}
              role="listbox"
              style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
              className="z-[60] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-lg"
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
