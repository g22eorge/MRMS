import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

import { reminderState } from "@/lib/notifications/reminder-state";

/**
 * Saying what the two reminder switches add up to.
 *
 * Whether a customer gets chased depends on two independent settings: reminders
 * enabled, and preview-only cleared. Both are well explained where they are
 * set. Neither said what the pair currently amounts to, and the combination
 * that matters — on, but still previewing — is the one where a business
 * believes it has handed collections to the system and has not, while overdue
 * invoices quietly go unchased.
 *
 * The behaviour is deliberately unchanged. Preview-first is a good default and
 * the engine is already honest about it, recording "dry-run" separately from
 * "queued". This was a silence, not a bug, and the fix is a sentence.
 */

describe("the combination someone is most likely to misread", () => {
  it("names on-but-previewing as sending nothing", () => {
    const s = reminderState({ enabled: true, dryRun: true });
    expect(s.mode).toBe("preview");
    expect(s.looksOnButSendsNothing).toBe(true);
    expect(s.headline).toContain("nothing is reaching customers");
  });

  it("says the invoices still need chasing by hand", () => {
    // The practical consequence, which is the part a business acts on.
    expect(reminderState({ enabled: true, dryRun: true }).detail).toContain("by hand");
  });

  it("says how to leave preview, rather than only that you are in it", () => {
    expect(reminderState({ enabled: true, dryRun: true }).detail).toContain("Preview only");
  });
});

describe("the other states are not dressed up as problems", () => {
  it("treats fully on as good news", () => {
    const s = reminderState({ enabled: true, dryRun: false });
    expect(s.mode).toBe("live");
    expect(s.looksOnButSendsNothing).toBe(false);
  });

  it("treats off as off, without a warning", () => {
    // Deliberately not chasing is a choice, not a fault. Flagging it would
    // train people to ignore the flag that matters.
    const s = reminderState({ enabled: false, dryRun: true });
    expect(s.mode).toBe("off");
    expect(s.looksOnButSendsNothing).toBe(false);
  });

  it("treats disabled-with-preview-cleared as off, not as live", () => {
    // enabled is the outer gate; dryRun only matters once it is open.
    expect(reminderState({ enabled: false, dryRun: false }).mode).toBe("off");
  });

  it("handles never-configured settings as off rather than throwing", () => {
    expect(reminderState(null).mode).toBe("off");
  });
});

describe("the behaviour it describes is left alone", () => {
  const RUNNER = readFileSync("lib/notifications/payment-reminders.ts", "utf8");
  const CRON = readFileSync("app/api/cron/payment-reminders/route.ts", "utf8");

  it("preview still defaults on, and still cannot be cleared in the same save", () => {
    // Two deliberate actions before anything speaks for the business. This was
    // a silence to break, not a default to override.
    const CARD = readFileSync("components/settings/PaymentReminderSettingsCard.tsx", "utf8");
    expect(CARD).toContain("enabled && !settings?.enabled ? true");
  });

  it("a dry run is still counted apart from a real send", () => {
    expect(RUNNER).toContain('action: "queued" | "dry-run"');
    expect(CRON).toContain('"dry-run": 0');
  });
});

describe("it is shown where the assumption is made", () => {
  it("on the card, so the two switches have a combined readout", () => {
    const CARD = readFileSync("components/settings/PaymentReminderSettingsCard.tsx", "utf8");
    expect(CARD).toContain("reminderState(settings)");
    expect(CARD).toContain("state.headline");
  });

  it("and on the invoices page, where someone decides whether to chase by hand", () => {
    const PAGE = readFileSync("app/(app)/documents/invoices/page.tsx", "utf8");
    expect(PAGE).toContain("reminderStatus.looksOnButSendsNothing");
  });

  it("reads saved settings, not the form's current ticks", () => {
    // An unticked box that has not been saved must not change what the banner
    // claims is happening right now.
    const CARD = readFileSync("components/settings/PaymentReminderSettingsCard.tsx", "utf8");
    expect(CARD).toContain("reminderState(settings)");
    expect(CARD).not.toContain("reminderState(s)");
  });
});
