import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * The headline on the admin dashboard's "Needs action" card.
 *
 * It read "119 open", and the owner asked whether that was supposed to be
 * there. The card is: it is the first thing an administrator looks at, and it
 * carries a deliberate "Start here" cue. The number was not.
 *
 * Seven rows feed it, five of which are Job queries that overlap by
 * construction. A job sitting in AWAITING_APPROVAL, received eight days ago and
 * never contacted, satisfies three of them at once — awaiting approval, overdue,
 * and no client update — so summing the rows counted the same piece of work
 * three times. The rows were each correct; the total was a number nobody could
 * reconcile against their own book, which is worse than showing no total.
 */

const DATA = readFileSync("app/(app)/dashboard/sections/admin-data.ts", "utf8");
const VIEW = readFileSync("app/(app)/dashboard/sections/AdminDashboard.tsx", "utf8");

describe("the total is a distinct count, not a sum of overlapping rows", () => {
  it("no longer adds the row counts together", () => {
    expect(VIEW).not.toContain("needs.reduce((s, n) => s + n.count, 0)");
  });

  it("counts jobs once, then adds only the two tables that cannot overlap", () => {
    // Failed messages are OutboundMessage rows and the intake queue is its own
    // table, so neither can double up with a job or with each other.
    expect(VIEW).toContain("jobsNeedingActionCount + failedOutboxCount + intakePendingCount");
  });
});

describe("the distinct query covers exactly the five job rows", () => {
  // Bounded from the comment forward — "payoutDueJobs" also appears earlier in
  // the destructuring list, so a plain indexOf for it slices backwards and
  // yields nothing, which would pass every assertion below vacuously.
  const start = DATA.indexOf("How many JOBS need attention");
  const query = DATA.slice(start, DATA.indexOf("payoutDueJobs", start));

  it("is one query with an OR, not five counts", () => {
    expect(query).toContain("OR: [");
  });

  it("includes every job-based row shown on the card", () => {
    for (const condition of [
      '{ status: "AWAITING_APPROVAL" }',
      '{ status: "READY_FOR_PICKUP" }',
      'clientBill: { gt: 0 }, clientPaid: false',   // completed & unpaid
      "receivedAt: { lt: new Date(today.getTime() - 7 * 86_400_000) }", // overdue
      "lastClientContactAt: null",                  // no client update
    ]) {
      expect(query).toContain(condition);
    }
  });

  it("keeps the org filter, so the total is never cross-tenant", () => {
    // A dashboard number that quietly spans organisations is the worst kind of
    // wrong on a multi-tenant product.
    expect(query).toContain("...orgFilter");
  });

  it("falls back to zero rather than breaking the dashboard", () => {
    expect(query).toContain("catch(() => 0)");
  });
});

describe("the individual rows are untouched", () => {
  it("still shows all seven, with their own counts", () => {
    // Each row was accurate and useful; only their sum was wrong. Collapsing
    // them into the distinct figure would have removed the detail that tells
    // someone where to start.
    for (const label of [
      "Overdue jobs", "Failed messages", "Completed & unpaid",
      "Awaiting approval", "No client update", "Ready — nudge pickup", "Intake queue",
    ]) {
      expect(VIEW).toContain(label);
    }
  });

  it("still sinks empty rows and marks where to start", () => {
    expect(VIEW).toContain("needsSorted");
    expect(VIEW).toContain("startHereLabel");
  });
});
