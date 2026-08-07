import { OrgModule } from "@prisma/client";

import { MODULE_ICON_PATHS } from "@/lib/module-catalog";

/**
 * Monochrome, on-brand module glyph. Uses `currentColor`, so colour is set by
 * the parent's text colour (e.g. `text-[var(--accent)]`). Replaces the old
 * multi-colour emoji icons across onboarding, billing, and admin views.
 */
export function ModuleIcon({
  module,
  className = "h-4 w-4",
}: {
  module: OrgModule;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={MODULE_ICON_PATHS[module]} />
    </svg>
  );
}
