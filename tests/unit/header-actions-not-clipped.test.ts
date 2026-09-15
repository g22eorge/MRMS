import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * A header action must be able to render outside its card.
 *
 * The reported defect: "the new expense button remains stagnant or it brings an
 * object that remains hidden and not usable". It was real, and it was two
 * compounding faults rather than one.
 *
 *  1. PageHeader's card carried `overflow-hidden`. The action's popup was an
 *     absolutely-positioned <details> panel anchored `top-full` below the card,
 *     so the card's own overflow rule clipped it away. It stayed in the DOM —
 *     present, focusable, and completely invisible — which is why the button
 *     looked dead rather than obviously broken.
 *
 *  2. The popup's <form> had no way to report a rejected save: the create
 *     actions redirected to `?error=…`, which re-rendered the page with the
 *     popup closed, so the message landed out of view. A validation failure and
 *     a dead control looked identical.
 *
 * Both are structural, both are one line to reintroduce, and neither is caught
 * by TypeScript, the render, or a passing build. Hence a scan — the same
 * reasoning as tests/unit/no-nested-forms.test.ts.
 *
 * The fix replaced the three popovers with portal Modals (which escape clipping
 * entirely because they render into document.body) and dropped the header's
 * overflow rule. These assertions hold both halves in place.
 */

const PAGE_HEADER = "components/ui/PageHeader.tsx";

/** The create controls that were reported as stagnant, and their dialogs. */
const CREATE_CONTROLS = [
  {
    page: "app/(app)/finance/expenses/page.tsx",
    dialog: "app/(app)/finance/expenses/CreateExpenseDialog.tsx",
    component: "CreateExpenseDialog",
  },
  {
    page: "app/(app)/finance/tax-rates/page.tsx",
    dialog: "app/(app)/finance/tax-rates/CreateTaxRateDialog.tsx",
    component: "CreateTaxRateDialog",
  },
  {
    page: "app/(app)/finance/recurring/page.tsx",
    dialog: "app/(app)/finance/recurring/CreateRecurringTemplateDialog.tsx",
    component: "CreateRecurringTemplateDialog",
  },
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** Comments describe the rule above; they are not markup. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");
}

describe("the header card does not clip its own actions", () => {
  it("PageHeader's card does not declare overflow-hidden", () => {
    expect(read(PAGE_HEADER)).not.toContain("dc-card overflow-hidden");
  });

  it("the detector recognises the class it is looking for", () => {
    // Guards the guard: a string that never matches would pass forever.
    expect('<div className="dc-card overflow-hidden">').toContain("dc-card overflow-hidden");
    expect('<div className="dc-card">').not.toContain("dc-card overflow-hidden");
  });
});

describe("the finance create controls report in a modal, not a clipped popover", () => {
  for (const { page, dialog, component } of CREATE_CONTROLS) {
    it(`${component} renders through the portal Modal`, () => {
      const src = read(dialog);
      // The portal is what makes clipping impossible: it mounts on document.body.
      expect(src).toContain('from "@/components/ui/Modal"');
      expect(src).toContain("<Modal");
      // The old shape: an absolutely-positioned panel tucked under the card.
      expect(stripComments(src)).not.toContain("absolute right-0 top-full");
    });

    it(`${page} uses ${component} and no longer hand-rolls a header popover`, () => {
      const src = read(page);
      expect(src).toContain(component);
      expect(stripComments(src)).not.toContain("absolute right-0 top-full");
    });

    it(`${component} surfaces a rejected save instead of closing over it`, () => {
      const src = read(dialog);
      // The error must render inside the dialog, where the form still is.
      expect(src).toContain("state?.error");
      // And a failure must not close the modal, or the message is out of view.
      expect(src).toContain("if (!result?.error)");
    });
  }
});