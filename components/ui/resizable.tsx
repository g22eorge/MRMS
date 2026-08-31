"use client";

import { Group, Panel, Separator } from "react-resizable-panels";

/**
 * Resizable panels, in this application's own tokens.
 *
 * A thin wrapper over react-resizable-panels v4, whose components are named
 * Group / Panel / Separator — the v4 rename from PanelGroup /
 * PanelResizeHandle, along with `direction` becoming `orientation`. The names
 * here follow the shadcn convention the rest of the interface uses, while the
 * styling comes from var(--line) and var(--accent).
 *
 * Two things about this library are easy to get wrong, and the first cost a
 * round here:
 *
 *   - The Separator exposes `aria-orientation`, NOT `data-orientation`. Styling
 *     it with data-[orientation=…] silently matches nothing, and the handle
 *     renders 0px wide — present in the DOM, tabbable, and impossible to grab.
 *     It looked correct in a screenshot because the panels themselves were
 *     fine; only measuring the separator showed it.
 *   - The orientations are inverted with respect to the group. A HORIZONTAL
 *     group (panels side by side) has a VERTICAL separator, because the divider
 *     line runs vertically. So the width rule belongs on aria-orientation
 *     vertical.
 *
 * The handle is a wide hit area around a hairline rule, so it can be grabbed
 * without precision aiming while still reading as a divider.
 */

export function ResizablePanelGroup({
  className = "",
  ...props
}: React.ComponentProps<typeof Group>) {
  // The library sets its own flex direction inline from `orientation`; this
  // only supplies sizing.
  return <Group className={`h-full w-full ${className}`} {...props} />;
}

export const ResizablePanel = Panel;

export function ResizableHandle({
  withHandle = false,
  className = "",
  ...props
}: React.ComponentProps<typeof Separator> & { withHandle?: boolean }) {
  return (
    <Separator
      className={
        "group relative flex shrink-0 items-center justify-center " +
        // Vertical separator = horizontal group = panels side by side.
        "aria-[orientation=vertical]:w-3 aria-[orientation=vertical]:cursor-col-resize " +
        "aria-[orientation=horizontal]:h-3 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 " +
        className
      }
      {...props}
    >
      <span
        aria-hidden
        className={
          "bg-[var(--line)] transition-colors group-hover:bg-[var(--accent)]/50 group-data-[separator=active]:bg-[var(--accent)] " +
          "group-aria-[orientation=vertical]:h-full group-aria-[orientation=vertical]:w-px " +
          "group-aria-[orientation=horizontal]:h-px group-aria-[orientation=horizontal]:w-full"
        }
      />
      {withHandle ? (
        <span
          aria-hidden
          className={
            "absolute z-10 flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] " +
            "transition-colors group-hover:border-[var(--accent)]/50 " +
            "group-aria-[orientation=vertical]:h-8 group-aria-[orientation=vertical]:w-3 " +
            "group-aria-[orientation=horizontal]:h-3 group-aria-[orientation=horizontal]:w-8"
          }
        >
          <span
            className={
              "rounded-full bg-[var(--ink-muted)]/60 " +
              "group-aria-[orientation=vertical]:h-3 group-aria-[orientation=vertical]:w-px " +
              "group-aria-[orientation=horizontal]:h-px group-aria-[orientation=horizontal]:w-3"
            }
          />
        </span>
      ) : null}
    </Separator>
  );
}
