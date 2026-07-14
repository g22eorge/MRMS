"use client";

import { type Role, type OrgModule } from "@prisma/client";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Modal } from "@/components/ui/Modal";
import {
  buildCommandPaletteActions,
  filterCommandActions,
  type CommandPaletteAction,
  type CommandPaletteSearchResult,
} from "@/lib/command-palette/quick-actions";

type CommandPaletteContextValue = {
  open: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: () => {},
});

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

const KIND_LABELS: Record<CommandPaletteSearchResult["kind"], string> = {
  job: "Job",
  client: "Client",
  invoice: "Invoice",
};

type SelectableItem =
  | { type: "action"; item: CommandPaletteAction }
  | { type: "result"; item: CommandPaletteSearchResult };

export function CommandPaletteProvider({
  role,
  permissions = [],
  enabledModules,
  children,
}: {
  role: Role;
  permissions?: string[];
  enabledModules: OrgModule[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const actions = useMemo(
    () => buildCommandPaletteActions({ role, permissions, enabledModules }),
    [role, permissions, enabledModules],
  );

  return (
    <CommandPaletteContext.Provider value={{ open: openPalette }}>
      {children}
      <CommandPaletteDialog
        open={open}
        onClose={closePalette}
        actions={actions}
      />
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteDialog({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: CommandPaletteAction[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommandPaletteSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredActions = useMemo(() => filterCommandActions(actions, query), [actions, query]);

  const items = useMemo<SelectableItem[]>(() => {
    const list: SelectableItem[] = filteredActions.map((item) => ({ type: "action", item }));
    for (const item of results) list.push({ type: "result", item });
    return list;
  }, [filteredActions, results]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLoading(false);
      setActiveIndex(0);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length, filteredActions.length]);

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/command-palette/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as { results?: CommandPaletteSearchResult[] };
        setResults(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  function goTo(item: SelectableItem) {
    const href = item.type === "action" ? item.item.href : item.item.href;
    onClose();
    router.push(href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (items.length === 0 ? 0 : (index - 1 + items.length) % items.length));
      return;
    }
    if (event.key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      goTo(items[activeIndex]);
    }
  }

  const quickActions = filteredActions.filter((action) => action.group === "quick");
  const navigateActions = filteredActions.filter((action) => action.group === "navigate");

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabel="Command palette"
      panelClassName="overflow-hidden p-0"
      backdropClassName="bg-black/45"
      closeOnEscape={false}
    >
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--ink-muted)]" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search jobs, clients, invoices…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-muted)] sm:inline">
            esc
          </kbd>
        </div>
      </div>

      <div className="max-h-[min(60vh,420px)] overflow-y-auto px-2 py-2">
        {quickActions.length > 0 ? (
          <CommandSection title="Quick actions">
            {quickActions.map((action) => {
              const index = items.findIndex((item) => item.type === "action" && item.item.id === action.id);
              return (
                <CommandRow
                  key={action.id}
                  active={index === activeIndex}
                  label={action.label}
                  description={action.description}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goTo({ type: "action", item: action })}
                />
              );
            })}
          </CommandSection>
        ) : null}

        {navigateActions.length > 0 ? (
          <CommandSection title="Go to">
            {navigateActions.map((action) => {
              const index = items.findIndex((item) => item.type === "action" && item.item.id === action.id);
              return (
                <CommandRow
                  key={action.id}
                  active={index === activeIndex}
                  label={action.label}
                  description={action.description}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goTo({ type: "action", item: action })}
                />
              );
            })}
          </CommandSection>
        ) : null}

        {query.trim().length >= 2 ? (
          <CommandSection title={loading ? "Searching…" : "Matches"}>
            {results.length === 0 && !loading ? (
              <p className="px-3 py-2 text-xs text-[var(--ink-muted)]">No matches for “{query.trim()}”.</p>
            ) : null}
            {results.map((result) => {
              const index = items.findIndex((item) => item.type === "result" && item.item.id === result.id);
              return (
                <CommandRow
                  key={result.id}
                  active={index === activeIndex}
                  label={result.label}
                  description={result.description}
                  badge={KIND_LABELS[result.kind]}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goTo({ type: "result", item: result })}
                />
              );
            })}
          </CommandSection>
        ) : null}

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-[var(--ink-muted)]">
            Type to search by job ref, client phone, or invoice number.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function CommandSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-1">
      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function CommandRow({
  label,
  description,
  badge,
  active,
  onClick,
  onMouseEnter,
}: {
  label: string;
  description: string;
  badge?: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
        active ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/30" : "hover:bg-[var(--panel-strong)]"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--ink)]">{label}</span>
        <span className="block truncate text-xs text-[var(--ink-muted)]">{description}</span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function CommandPaletteTrigger({ className = "" }: { className?: string }) {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className={`hidden items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--ink)] md:inline-flex ${className}`.trim()}
      aria-label="Open command palette"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <span>Search…</span>
      <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1 py-0.5 text-[10px] font-semibold">⌘K</kbd>
    </button>
  );
}
