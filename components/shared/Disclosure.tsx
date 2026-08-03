"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Disclosure — client-side reveal for "New X" create forms whose trigger button
 * sits far from the form (e.g. in a page or table header). Replaces the
 * `<Link href="?new=1">` reveal that forced a full server round-trip — re-running
 * every query on the page just to show an empty form.
 *
 * Wrap the region in <Disclosure>, drop a <DisclosureButton> where the trigger
 * lives, and a <DisclosurePanel> around the form. Toggling is pure client state:
 * no navigation, no reload. Server actions inside the panel are unaffected. When
 * the trigger button and the form sit together, prefer `InlineCreate` instead.
 */

type DisclosureContextValue = { open: boolean; toggle: () => void };

const DisclosureContext = createContext<DisclosureContextValue | null>(null);

function useDisclosureContext() {
  const ctx = useContext(DisclosureContext);
  if (!ctx) throw new Error("Disclosure components must be rendered inside <Disclosure>");
  return ctx;
}

export function Disclosure({ children, defaultOpen = false }: { children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <DisclosureContext.Provider value={{ open, toggle: () => setOpen((value) => !value) }}>
      {children}
    </DisclosureContext.Provider>
  );
}

export function DisclosureButton({
  label,
  openLabel,
  className,
  openClassName,
}: {
  label: ReactNode;
  /** Label shown while the panel is open (defaults to `label`). */
  openLabel?: ReactNode;
  className?: string;
  /** Class applied while the panel is open (defaults to `className`). */
  openClassName?: string;
}) {
  const { open, toggle } = useDisclosureContext();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className={open ? openClassName ?? className : className}
    >
      {open ? openLabel ?? label : label}
    </button>
  );
}

export function DisclosurePanel({ children }: { children: ReactNode }) {
  const { open } = useDisclosureContext();
  return open ? <>{children}</> : null;
}
