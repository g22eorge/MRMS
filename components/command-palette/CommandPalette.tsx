"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Modal } from "@/components/ui/Modal";

import type { CommandPaletteAction, CommandPaletteResponse, CommandPaletteSearchHit } from "@/lib/command-palette/types";

type PaletteRow =
  | { type: "action"; item: CommandPaletteAction }
  | { type: "result"; item: CommandPaletteSearchHit };

const KIND_LABELS: Record<CommandPaletteSearchHit["kind"], string> = {
  job: "Job",
  client: "Client",
  invoice: "Invoice",
  quotation: "Quotation",
  product: "Product",
  supplier: "Supplier",
};

function groupLabel(row: PaletteRow) {
  if (row.type === "action") return row.item.group;
  return "Search results";
}

export function CommandPalette({ role }: { role: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<CommandPaletteAction[]>([]);
  const [results, setResults] = useState<CommandPaletteSearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo<PaletteRow[]>(() => {
    const next: PaletteRow[] = actions.map((item) => ({ type: "action", item }));
    for (const item of results) next.push({ type: "result", item });
    return next;
  }, [actions, results]);

  const fetchPalette = useCallback(
    async (nextQuery: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (nextQuery.trim()) params.set("q", nextQuery.trim());
        const res = await fetch(`/api/command-palette?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as CommandPaletteResponse;
        setActions(data.actions);
        setResults(data.results);
        setActiveIndex(0);
      } catch {
        setError("Could not load command palette.");
        setActions([]);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setError(null);
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    void fetchPalette("");
  }, [fetchPalette]);

  const activateRow = useCallback(
    (row: PaletteRow | undefined) => {
      if (!row) return;
      const href = row.type === "action" ? row.item.href : row.item.href;
      close();
      router.push(href);
    },
    [close, router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typingInField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
        return;
      }

      if (event.key === "Escape" && open) {
        event.preventDefault();
        close();
        return;
      }

      if (!open) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        if (typingInField && target !== inputRef.current) return;
        event.preventDefault();
        activateRow(rows[activeIndex]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, rows, activeIndex, openPalette, close, activateRow]);

  useEffect(() => {
    function onOpenEvent() {
      openPalette();
    }
    window.addEventListener("open-command-palette", onOpenEvent);
    return () => window.removeEventListener("open-command-palette", onOpenEvent);
  }, [openPalette]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void fetchPalette(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, query, fetchPalette]);

  useEffect(() => {
    if (activeIndex >= rows.length) setActiveIndex(Math.max(rows.length - 1, 0));
  }, [rows.length, activeIndex]);

  let lastGroup = "";

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      ariaLabel="Command palette"
      panelClassName="max-w-xl overflow-hidden"
      backdropClassName="bg-black/45"
    >
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ink-muted)]" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs, clients, invoices, quotations, products…"
            className="w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
            aria-label="Command palette search"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded border border-[var(--line)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-muted)] sm:inline">
            Esc
          </kbd>
        </div>
        <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
          Jump anywhere or run a quick action · role {role.replaceAll("_", " ").toLowerCase()}
        </p>
      </div>

      <div className="max-h-[min(60vh,420px)] overflow-y-auto px-2 py-2">
        {error ? (
          <p className="px-3 py-6 text-center text-sm text-red-600">{error}</p>
        ) : loading && rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--ink-muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--ink-muted)]">
            {query.trim() ? "No matches found." : "No commands available for your role."}
          </p>
        ) : (
          rows.map((row, index) => {
            const group = groupLabel(row);
            const showGroup = group !== lastGroup;
            lastGroup = group;
            const selected = index === activeIndex;
            const label = row.type === "action" ? row.item.label : row.item.label;
            const description = row.type === "action" ? row.item.description : row.item.description;
            return (
              <div key={row.type === "action" ? row.item.id : row.item.id}>
                {showGroup ? (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                    {group}
                  </p>
                ) : null}
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => activateRow(row)}
                  className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    selected ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/30" : "hover:bg-[var(--panel-strong)]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">{label}</span>
                    {description ? (
                      <span className="mt-0.5 block truncate text-xs text-[var(--ink-muted)]">{description}</span>
                    ) : null}
                  </span>
                  {row.type === "result" ? (
                    <span className="shrink-0 rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                      {KIND_LABELS[row.item.kind]}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2 text-[10px] text-[var(--ink-muted)]">
        <span>Use ↑ ↓ and Enter</span>
        <span className="hidden sm:inline">
          <kbd className="rounded border border-[var(--line)] bg-[var(--panel-strong)] px-1.5 py-0.5 font-semibold">⌘</kbd>
          {" "}
          <kbd className="rounded border border-[var(--line)] bg-[var(--panel-strong)] px-1.5 py-0.5 font-semibold">K</kbd>
        </span>
      </div>
    </Modal>
  );
}
