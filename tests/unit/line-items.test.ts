import { describe, expect, it } from "bun:test";

import {
  appendJsonLineItems,
  commercialLineTotal,
  createLineItemKey,
  emptyCommercialLineItem,
  parseFormNumber,
} from "../../lib/forms/line-items";

describe("createLineItemKey()", () => {
  it("returns unique incrementing keys", () => {
    const first = createLineItemKey();
    const second = createLineItemKey();
    expect(second).toBeGreaterThan(first);
  });
});

describe("parseFormNumber()", () => {
  it("parses finite numbers", () => {
    expect(parseFormNumber("12.5")).toBe(12.5);
  });

  it("returns fallback for invalid input", () => {
    expect(parseFormNumber("abc", 3)).toBe(3);
  });
});

describe("commercialLineTotal()", () => {
  it("applies discount when allowed", () => {
    const item = { ...emptyCommercialLineItem(), quantity: 2, unitPrice: 100, discount: 10 };
    expect(commercialLineTotal(item, true)).toBe(180);
  });

  it("ignores discount when not allowed", () => {
    const item = { ...emptyCommercialLineItem(), quantity: 2, unitPrice: 100, discount: 10 };
    expect(commercialLineTotal(item, false)).toBe(200);
  });
});

describe("appendJsonLineItems()", () => {
  it("serializes mapped rows into form data", () => {
    const fd = new FormData();
    appendJsonLineItems(fd, "items", [{ qty: 2, label: "Widget" }], (row) => row);
    expect(fd.get("items")).toBe(JSON.stringify([{ qty: 2, label: "Widget" }]));
  });
});

describe("emptyCommercialLineItem()", () => {
  it("returns a blank commercial line", () => {
    expect(emptyCommercialLineItem()).toEqual({
      partId: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
    });
  });
});
