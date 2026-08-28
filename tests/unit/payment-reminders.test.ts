import { describe, it, expect } from "bun:test";

import {
  REMINDER_LADDER,
  effectiveDueDate,
  reminderAnchor,
  stageDueNow,
  withinQuietHours,
} from "../../lib/notifications/payment-reminder-schedule";

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function invoice(over: Partial<Parameters<typeof effectiveDueDate>[0]> = {}) {
  return {
    issuedAt: day("2026-09-01"),
    dueDate: null,
    deliveryNotes: [] as Array<{ deliveredAt: Date }>,
    job: null,
    ...over,
  } as Parameters<typeof effectiveDueDate>[0];
}

describe("reminder anchor", () => {
  it("prefers the delivery note — the terms run from when goods were received", () => {
    const a = reminderAnchor(invoice({
      deliveryNotes: [{ deliveredAt: day("2026-09-05") }],
      job: { deliveredAt: day("2026-09-04"), completedAt: day("2026-09-03") },
    }));
    expect(a.source).toBe("delivery-note");
    expect(a.at).toEqual(day("2026-09-05"));
  });

  it("falls back to job handover when there is no delivery note", () => {
    const a = reminderAnchor(invoice({ job: { deliveredAt: day("2026-09-04"), completedAt: null } }));
    expect(a.source).toBe("job-handover");
  });

  it("falls back to the issue date, because most invoices have neither", () => {
    // The reason the chain exists: anchoring only on delivery would have fired
    // on one invoice out of twenty and looked like it was working.
    expect(reminderAnchor(invoice()).source).toBe("issued");
  });
});

describe("effective due date", () => {
  it("uses the invoice's own due date when it has one", () => {
    expect(effectiveDueDate(invoice({ dueDate: day("2026-10-15") }), 30)).toEqual(day("2026-10-15"));
  });

  it("otherwise counts the terms from the anchor, not from issue", () => {
    const due = effectiveDueDate(invoice({ deliveryNotes: [{ deliveredAt: day("2026-09-10") }] }), 30);
    expect(due).toEqual(day("2026-10-10"));
  });
});

describe("ladder", () => {
  const due = day("2026-10-01");

  it("says nothing for the first three weeks of a 30-day term", () => {
    // Silence early is the design, not an oversight: chasing someone who is not
    // late trains them to ignore the channel before it is needed.
    expect(stageDueNow(due, day("2026-09-05"))).toBeNull();
    expect(stageDueNow(due, day("2026-09-20"))).toBeNull();
  });

  it("opens with a courtesy a week out", () => {
    expect(stageDueNow(due, day("2026-09-24"))?.key).toBe("T-7");
  });

  it("marks the due date itself", () => {
    expect(stageDueNow(due, day("2026-10-01"))?.key).toBe("DUE");
  });

  it("escalates after the due date", () => {
    // A history is passed because these rungs are only reachable by an invoice
    // that has been climbing; a cold start is held back deliberately.
    expect(stageDueNow(due, day("2026-10-04"), ["DUE"])?.key).toBe("+3");
    expect(stageDueNow(due, day("2026-10-11"), ["DUE", "+3"])?.key).toBe("+10");
  });

  it("stops after the final rung instead of chasing forever", () => {
    // An invoice three weeks past terms needs a person, not an eleventh message.
    expect(stageDueNow(due, day("2026-11-30"), ["DUE", "+3", "+10"])?.key).toBe("+10");
    expect(REMINDER_LADDER.at(-1)?.key).toBe("+10");
  });

  it("never returns a backlog — only the rung actually reached", () => {
    // An invoice that becomes eligible late must not fire four messages at once
    // to catch up; it returns one rung, the latest.
    expect(stageDueNow(due, day("2026-10-20"), ["DUE", "+3"])?.key).toBe("+10");
  });

  it("tones escalate in order and end firm, not shrill", () => {
    expect(REMINDER_LADDER.map((s) => s.tone)).toEqual(["courtesy", "courtesy", "due", "firm", "final"]);
  });
});

describe("quiet hours", () => {
  const at = (h: number) => { const d = new Date("2026-10-01T00:00:00"); d.setHours(h, 0, 0, 0); return d; };

  it("refuses the small hours", () => {
    expect(withinQuietHours(at(6), 8, 20)).toBe(false);
    expect(withinQuietHours(at(22), 8, 20)).toBe(false);
  });

  it("allows the working day, start inclusive and end exclusive", () => {
    expect(withinQuietHours(at(8), 8, 20)).toBe(true);
    expect(withinQuietHours(at(19), 8, 20)).toBe(true);
    expect(withinQuietHours(at(20), 8, 20)).toBe(false);
  });
});

describe("cold start", () => {
  const due = day("2026-10-01");

  it("does not open at the final rung on an invoice that has had nothing", () => {
    // Switching the feature on over a book of old invoices must not greet
    // customers with "this is our last automatic reminder" when there were no
    // earlier ones. That sentence is false and reads as an accusation.
    const stage = stageDueNow(due, day("2026-10-20"), []);
    expect(stage?.tone).not.toBe("final");
  });

  it("opens a cold overdue invoice at the mildest rung that is still true", () => {
    // Not the courtesy or the due-day notice: both would state something false
    // about an invoice that passed its date three weeks ago.
    expect(stageDueNow(due, day("2026-10-20"), [])?.tone).toBe("firm");
  });

  it("still climbs normally once something has been sent", () => {
    expect(stageDueNow(due, day("2026-10-20"), ["DUE"])?.key).toBe("+10");
    expect(stageDueNow(due, day("2026-10-04"), ["DUE"])?.key).toBe("+3");
  });

  it("leaves an in-terms cold start exactly where it was", () => {
    // A courtesy is already the gentlest rung, so nothing should change.
    expect(stageDueNow(due, day("2026-09-24"), [])?.key).toBe("T-7");
  });

  it("stays silent before the ladder opens, history or not", () => {
    expect(stageDueNow(due, day("2026-09-05"), [])).toBeNull();
  });
});
