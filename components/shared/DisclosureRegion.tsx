"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * DisclosureRegion — shared client state for a "New X" create form whose trigger
 * button lives far from the form itself (e.g. a page header CTA and a body panel).
 *
 * Replaces the `<Link href="?param=1">` reveal pattern that showed an on-page
 * create/edit form via a full server round-trip (re-running every query on the
 * page just to render an empty form). The trigger(s) and the panel share one
 * piece of local state through context — no navigation, no reload.
 *
 * Wrap the region in `<DisclosureProvider>`, place `<DisclosureTrigger>` where
 * the button belongs (header, action bar, empty-state, …) and `<DisclosurePanel>`
 * around the form. The form keeps its server action unchanged.
 *
 * For a trigger and form that sit together, prefer `InlineCreate`.
 */

type DisclosureContextValue = {
  open: boolean;
  toggle: () => void;
  setOpen: (value: boolean) => void;
};

const DisclosureContext = createContext<DisclosureContextValue | null>(null);

function useDisclosure(): DisclosureContextValue {
  const ctx = useContext(DisclosureContext);
  if (!ctx) throw new Error("Disclosure components must be used inside <DisclosureProvider>");
  return ctx;
}

export function DisclosureProvider({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <DisclosureContext.Provider value={{ open, toggle: () => setOpen((v) => !v), setOpen }}>
      {children}
    </DisclosureContext.Provider>
  );
}

/** The trigger button. `className` may be a fixed string or `(open) => string`. */
export function DisclosureTrigger({
  label,
  openLabel,
  className,
  title,
  "aria-label": ariaLabel,
}: {
  label: ReactNode;
  openLabel?: ReactNode;
  className?: string | ((open: boolean) => string);
  title?: string;
  "aria-label"?: string;
}) {
  const { open, toggle } = useDisclosure();
  const cls = typeof className === "function" ? className(open) : className;
  return (
    <button type="button" onClick={toggle} className={cls} aria-expanded={open} title={title} aria-label={ariaLabel}>
      {open ? openLabel ?? label : label}
    </button>
  );
}

/** Renders its children only while the region is open. */
export function DisclosurePanel({ children }: { children: ReactNode }) {
  const { open } = useDisclosure();
  return open ? <>{children}</> : null;
}

/** A "Cancel"/close control for use inside a panel. */
export function DisclosureClose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { setOpen } = useDisclosure();
  return (
    <button type="button" onClick={() => setOpen(false)} className={className}>
      {children}
    </button>
  );
}
