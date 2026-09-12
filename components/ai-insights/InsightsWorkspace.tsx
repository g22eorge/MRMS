"use client";

import type { ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

/**
 * The AI Insights layout: figures on one side, copilot on the other.
 *
 * What this replaces: the copilot sat between the KPI cards and the insight
 * cards, so it interrupted the data rather than accompanying it. You read four
 * figures, hit a chat box, and the numbers you wanted to ask about scrolled out
 * of view the moment you started typing. Asking "why is cash down?" while
 * unable to see the cash figure is the whole problem.
 *
 * Side by side, the copilot stays put while the figures scroll independently,
 * and the split is draggable because the right ratio depends on what you are
 * doing — reading the numbers wants a wide left pane, working through a
 * question wants a wide right one.
 *
 * Below the xl breakpoint this degrades to a plain stack, with the copilot
 * last. Dragging a divider is a pointer gesture; on a phone it is at best
 * useless and at worst steals the scroll. The data reads top to bottom there,
 * which is the right order when there is only one column.
 */
export function InsightsWorkspace({
  figures,
  copilot,
}: {
  figures: ReactNode;
  copilot: ReactNode;
}) {
  return (
    <>
      {/* Small and medium screens: one column, copilot last. */}
      <div className="space-y-4 xl:hidden">
        {figures}
        {copilot}
      </div>

      {/* Desktop: draggable split, each side scrolling on its own.
          The ratio is not persisted between visits. v4 does that through the
          useDefaultLayout hook with a storage implementation, which needs care
          around server rendering — worth adding deliberately rather than
          bolting on here unverified. */}
      <div className="hidden h-[calc(100vh-11rem)] xl:block">
        <ResizablePanelGroup
          orientation="horizontal"
          // No height class here: the library sets height:100% inline on the
          // group, and an inline style beats a class — so h-* on this element
          // is silently ignored. The height lives on the wrapper above, which
          // is what that 100% then resolves against. Without it the group
          // takes its height from the left column's content (measured at
          // 1284px against a 720px window) and the composer lands below the
          // fold.
          className="items-stretch"
        >
          <ResizablePanel defaultSize="62%" minSize="40%" className="min-w-0">
            <div className="h-full overflow-y-auto pr-1">
              <div className="space-y-4">{figures}</div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize="38%" minSize="24%" className="min-w-0">
            {/* pl-1 keeps the card off the divider's hit area. */}
            <div className="h-full overflow-y-auto pl-1">{copilot}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  );
}
