import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

import { ACTIVE_JOB_STATUSES, ACTIVE_STATUSES_EXPECTING_CONTACT, JOB_STATUSES } from "@/lib/job-status";

/**
 * What counts as a job that is still work.
 *
 * There were five hand-written answers to this and they disagreed. The admin
 * dashboard's "Active" tile added three statuses; the queries directly beside
 * it used seven; the client portal used six; the technician spotlight used the
 * same six; the system overview used the same seven in a different order.
 *
 * Two of those were wrong in ways someone would feel. The tile understated the
 * shop's own workload, omitting diagnosis, referral, external repair and
 * awaiting collection. And the portal dropped IN_EXTERNAL_REPAIR, so a client
 * whose device had gone to an external repairer watched it disappear from their
 * active jobs — the job had not stalled, the definition had, and the client is
 * the one person with no way to check.
 *
 * Same root cause as the two price tables in §16: a fact restated in several
 * places rather than defined in one.
 */

describe("the canonical list is the whole of open work", () => {
  it("holds the seven statuses a job passes through before it is finished", () => {
    expect([...ACTIVE_JOB_STATUSES]).toEqual([
      "RECEIVED", "DIAGNOSING", "REFERRED", "IN_EXTERNAL_REPAIR",
      "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP",
    ]);
  });

  it("includes external repair, which is what the portal was dropping", () => {
    expect(ACTIVE_JOB_STATUSES).toContain("IN_EXTERNAL_REPAIR");
  });

  it("includes awaiting collection — ready is not the same as gone", () => {
    expect(ACTIVE_JOB_STATUSES).toContain("READY_FOR_PICKUP");
  });

  it("excludes the finished states", () => {
    for (const done of ["DELIVERED", "COMPLETED", "CLOSED"]) {
      expect(ACTIVE_JOB_STATUSES as readonly string[]).not.toContain(done);
    }
  });

  it("names only statuses the database actually stores", () => {
    for (const s of ACTIVE_JOB_STATUSES) {
      expect(JOB_STATUSES as readonly string[]).toContain(s);
    }
  });
});

describe("the contact-expecting list is derived, not retyped", () => {
  it("is the active list minus a job too new to have been neglected", () => {
    expect([...ACTIVE_STATUSES_EXPECTING_CONTACT])
      .toEqual(ACTIVE_JOB_STATUSES.filter((s) => s !== "RECEIVED"));
  });

  it("stays in step if the active list changes", () => {
    // The point of deriving it: a status added above appears here too, rather
    // than being silently missing from one of the two.
    expect(ACTIVE_STATUSES_EXPECTING_CONTACT.length).toBe(ACTIVE_JOB_STATUSES.length - 1);
  });
});

describe("every surface that means 'active' now says it the same way", () => {
  const files = [
    "app/(app)/dashboard/sections/admin-data.ts",
    "app/(portal)/portal/dashboard/page.tsx",
    "app/(app)/technicians/page.tsx",
    "app/(app)/dashboard/sections/SystemOverviewDashboard.tsx",
  ];

  for (const f of files) {
    it(`${f} uses the shared constant`, () => {
      expect(readFileSync(f, "utf8")).toContain("ACTIVE_JOB_STATUSES");
    });

    it(`${f} no longer carries its own copy`, () => {
      const src = readFileSync(f, "utf8");
      expect(src).not.toContain('"RECEIVED", "DIAGNOSING", "REFERRED", "AWAITING_APPROVAL"');
      expect(src).not.toContain('"RECEIVED", "DIAGNOSING", "REFERRED", "IN_EXTERNAL_REPAIR", "AWAITING_APPROVAL"');
    });
  }

  it("the Active tile is summed from the list rather than from three of it", () => {
    const data = readFileSync("app/(app)/dashboard/sections/admin-data.ts", "utf8");
    const view = readFileSync("app/(app)/dashboard/sections/AdminDashboard.tsx", "utf8");
    expect(data).toContain("ACTIVE_JOB_STATUSES.reduce(");
    // The old three-term derivation must be gone from the view entirely.
    expect(view).not.toContain('(statusCount.get("RECEIVED") ?? 0) + inRepairCount + awaitingApprovalCount');
  });
});

describe("deliberately left alone", () => {
  it("the job board still uses raw statuses, including the legacy external ones", () => {
    // The board groups by pre-normalisation database status and shows
    // WAITING_FOR_PARTS and the two legacy assignment states as their own
    // columns. That is a different question from "is this job open".
    const src = readFileSync("app/(app)/jobs/page.tsx", "utf8");
    expect(src).toContain("PENDING_EXTERNAL_ASSIGNMENT");
  });

  it("the field-technician dashboard still scopes to what a field tech works on", () => {
    const src = readFileSync("app/(app)/dashboard/sections/TechFieldDashboard.tsx", "utf8");
    expect(src).toContain('["RECEIVED", "DIAGNOSING", "IN_REPAIR"]');
  });
});
