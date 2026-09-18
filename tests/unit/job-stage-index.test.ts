import { describe, it, expect } from "bun:test";

import { jobStageIndex } from "@/lib/job-status";

/**
 * The progress rail once defaulted every unlisted status to stage 4, so jobs
 * in the external chain or WAITING_FOR_PARTS showed "Complete" while the
 * status buttons below offered repair steps. Every status must map somewhere
 * honest — and never to Complete unless finished.
 */
describe("jobStageIndex", () => {
  it("maps intake → diagnosis → approval in order", () => {
    expect(jobStageIndex("RECEIVED")).toBe(0);
    expect(jobStageIndex("DIAGNOSING")).toBe(1);
    expect(jobStageIndex("AWAITING_APPROVAL")).toBe(2);
  });

  it("keeps the whole external chain and parts-wait in Repair, not Complete", () => {
    for (const s of [
      "REFERRED",
      "PENDING_EXTERNAL_ASSIGNMENT",
      "ASSIGNED_ONE_TIME_EXTERNAL",
      "IN_EXTERNAL_REPAIR",
      "RETURNED_FROM_EXTERNAL",
      "IN_REPAIR",
      "WAITING_FOR_PARTS",
      "READY_FOR_PICKUP",
    ]) {
      expect(jobStageIndex(s)).toBe(3);
    }
  });

  it("shows Complete only for finished jobs", () => {
    for (const s of ["DELIVERED", "COMPLETED", "CLOSED"]) {
      expect(jobStageIndex(s)).toBe(4);
    }
  });

  it("fails safe to Repair for unknown statuses", () => {
    expect(jobStageIndex("SOMETHING_NEW")).toBe(3);
  });
});
