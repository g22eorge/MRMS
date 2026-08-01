import { describe, expect, it } from "bun:test";

import {
  JOB_DOCUMENT_KIND_LABELS,
  sortJobDocumentTimeline,
  type JobDocumentTimelineEntry,
} from "../../lib/jobs/job-document-timeline";

function entry(
  partial: Partial<JobDocumentTimelineEntry> & Pick<JobDocumentTimelineEntry, "id" | "kind" | "label" | "occurredAt">,
): JobDocumentTimelineEntry {
  return {
    pdfHref: "/api/test",
    listHref: "/documents/invoices",
    ...partial,
  };
}

describe("sortJobDocumentTimeline", () => {
  it("orders entries chronologically", () => {
    const sorted = sortJobDocumentTimeline([
      entry({ id: "2", kind: "invoice", label: "INV-2", occurredAt: new Date("2026-07-02") }),
      entry({ id: "1", kind: "job_card", label: "JOB-1", occurredAt: new Date("2026-07-01") }),
      entry({ id: "3", kind: "receipt", label: "RCP-1", occurredAt: new Date("2026-07-03") }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("labels all supported document kinds", () => {
    expect(JOB_DOCUMENT_KIND_LABELS.job_card).toBe("Job Card");
    expect(JOB_DOCUMENT_KIND_LABELS.delivery_note).toBe("Delivery Note");
    expect(JOB_DOCUMENT_KIND_LABELS.refund).toBe("Refund");
  });
});
