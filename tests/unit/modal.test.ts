import { describe, expect, it } from "bun:test";

import { modalPanelClassName, type ModalSize } from "../../lib/ui/modal";

describe("modalPanelClassName()", () => {
  it("includes shared panel shell classes", () => {
    expect(modalPanelClassName()).toContain("panel-shadow");
    expect(modalPanelClassName()).toContain("rounded-xl");
  });

  it("maps size tokens to max-width classes", () => {
    const sizes: ModalSize[] = ["sm", "md", "lg", "xl"];
    expect(modalPanelClassName("sm")).toContain("max-w-sm");
    expect(modalPanelClassName("md")).toContain("max-w-md");
    expect(modalPanelClassName("lg")).toContain("max-w-lg");
    expect(modalPanelClassName("xl")).toContain("max-w-2xl");
    expect(sizes.length).toBe(4);
  });

  it("appends extra panel classes", () => {
    expect(modalPanelClassName("md", "p-6")).toContain("p-6");
  });
});
