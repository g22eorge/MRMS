import { describe, expect, it } from "bun:test";

import {
  formatPhoneDisplay,
  normalizePhoneForStorage,
  normalizeUgPhone,
  phoneLookupVariants,
  phoneWhatsAppHref,
} from "../../lib/phone";

describe("normalizeUgPhone()", () => {
  it("normalizes local 0-prefix to E.164", () => {
    expect(normalizeUgPhone("0772123456", { format: "e164" })).toBe("+256772123456");
  });

  it("normalizes to WhatsApp digits without plus", () => {
    expect(normalizeUgPhone("+256 772 123 456", { format: "whatsapp" })).toBe("256772123456");
  });

  it("handles 9-digit mobile without leading zero", () => {
    expect(normalizeUgPhone("772123456", { format: "e164" })).toBe("+256772123456");
  });
});

describe("formatPhoneDisplay()", () => {
  it("formats standard UG mobile for display", () => {
    expect(formatPhoneDisplay("+256772123456")).toBe("+256 772 123 456");
    expect(formatPhoneDisplay("0772123456")).toBe("+256 772 123 456");
  });
});

describe("phoneLookupVariants()", () => {
  it("includes E.164, WhatsApp, and local shapes", () => {
    const variants = phoneLookupVariants("0772123456");
    expect(variants).toContain("+256772123456");
    expect(variants).toContain("256772123456");
    expect(variants).toContain("0772123456");
  });
});

describe("normalizePhoneForStorage()", () => {
  it("stores E.164 when parseable", () => {
    expect(normalizePhoneForStorage("0772 123 456")).toBe("+256772123456");
  });
});

describe("phoneWhatsAppHref()", () => {
  it("builds wa.me link from mixed input", () => {
    expect(phoneWhatsAppHref("0772123456")).toBe("https://wa.me/256772123456");
  });
});
