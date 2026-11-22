import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { isPlaceholderCredential, isRealCredential } from "@/lib/notifications/credential-placeholder";
import { whatsappIsConfigured } from "@/lib/notifications/whatsapp";

describe("isPlaceholderCredential", () => {
  it("recognises the values .env.example ships with", () => {
    for (const value of [
      "your_meta_access_token",
      "your_phone_number_id",
      "your_business_account_id",
      "your_meta_app_secret",
      "random_string_you_choose",
      "re_your_resend_api_key",
      "replace-with-a-long-random-secret",
      "<server-ip>",
    ]) {
      expect(isPlaceholderCredential(value)).toBe(true);
    }
  });

  it("leaves real-looking credentials alone", () => {
    for (const value of ["EAAGm0PX4ZCpsBAKZCx7yourTokenLooksLikeThis", "104857600123456", "re_8f3KQ2ab_Zx91LmNoPqRsTuVw"]) {
      expect(isPlaceholderCredential(value)).toBe(false);
      expect(isRealCredential(value)).toBe(true);
    }
  });

  it("treats empty as absent, not as a placeholder", () => {
    expect(isPlaceholderCredential("")).toBe(false);
    expect(isPlaceholderCredential(undefined)).toBe(false);
    expect(isRealCredential("  ")).toBe(false);
  });
});

describe("WhatsApp configuration with placeholder credentials", () => {
  const keys = ["WHATSAPP_BUSINESS_NUMBER", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) saved[key] = process.env[key];
  });
  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("is not configured when .env.example was copied unchanged", () => {
    process.env.WHATSAPP_BUSINESS_NUMBER = "+256700000000";
    process.env.WHATSAPP_ACCESS_TOKEN = "your_meta_access_token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "your_phone_number_id";
    expect(whatsappIsConfigured()).toBe(false);
  });

  it("is configured with real values", () => {
    process.env.WHATSAPP_BUSINESS_NUMBER = "+256772000000";
    process.env.WHATSAPP_ACCESS_TOKEN = "EAAGm0PX4ZCpsBAKZCx7realLookingToken";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "104857600123456";
    expect(whatsappIsConfigured()).toBe(true);
  });
});
