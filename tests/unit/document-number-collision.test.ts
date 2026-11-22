import { describe, it, expect } from "bun:test";

import { nextAvailableInvoiceNumber, nextDocumentNumber } from "@/lib/commercial/document-workflow";
import type { TxClient } from "@/lib/prisma";

/**
 * The counter can be behind the numbers already in use: jobs imported with
 * their invoice numbers stamped arrive without their DocumentSequence rows.
 * The allocator has to walk past every taken number, whichever table holds it.
 */
function fakeTx(opts: { sequence: number; invoices: string[]; jobs: string[] }) {
  let value = opts.sequence;
  const tx = {
    documentBrandingSettings: {
      findFirst: async () => ({ quotePrefix: "EIS", sequencePadLength: 4 }),
    },
    documentSequence: {
      upsert: async () => ({ value: (value += 1) }),
    },
    invoice: {
      findFirst: async ({ where }: { where: { invoiceNumber: string } }) =>
        opts.invoices.includes(where.invoiceNumber) ? { id: `inv-${where.invoiceNumber}` } : null,
      findUnique: async ({ where }: { where: { invoiceNumber: string } }) =>
        opts.invoices.includes(where.invoiceNumber) ? { id: `inv-${where.invoiceNumber}` } : null,
    },
    job: {
      findFirst: async ({ where }: { where: { invoiceNumber: string } }) =>
        opts.jobs.includes(where.invoiceNumber) ? { id: `job-${where.invoiceNumber}` } : null,
    },
  };
  return tx as unknown as TxClient;
}

const at = new Date("2026-11-21T12:00:00.000Z");

describe("nextDocumentNumber with a counter behind the numbers in use", () => {
  it("skips numbers held by invoices and by jobs", async () => {
    // The state found in the imported data: counter at 2, invoices hold
    // 0001-0002, jobs hold 0001-0004.
    const tx = fakeTx({
      sequence: 2,
      invoices: ["EIS/INV/2026/11/0001", "EIS/INV/2026/11/0002"],
      jobs: ["EIS/INV/2026/11/0001", "EIS/INV/2026/11/0002", "EIS/INV/2026/11/0003", "EIS/INV/2026/11/0004"],
    });
    expect(await nextDocumentNumber(tx, "INV", "invoice", "org-collision-a", at)).toBe("EIS/INV/2026/11/0005");
  });

  it("checks every candidate, not only the first", async () => {
    const tx = fakeTx({
      sequence: 0,
      invoices: ["EIS/INV/2026/11/0001", "EIS/INV/2026/11/0002", "EIS/INV/2026/11/0003"],
      jobs: [],
    });
    expect(await nextDocumentNumber(tx, "INV", "invoice", "org-collision-b", at)).toBe("EIS/INV/2026/11/0004");
  });

  it("returns the first number when nothing is taken", async () => {
    const tx = fakeTx({ sequence: 0, invoices: [], jobs: [] });
    expect(await nextDocumentNumber(tx, "INV", "invoice", "org-collision-c", at)).toBe("EIS/INV/2026/11/0001");
  });
});

describe("nextAvailableInvoiceNumber", () => {
  it("never hands a job a number another job already holds", async () => {
    const now = new Date();
    const stamp = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const tx = fakeTx({
      sequence: 2,
      invoices: [`EIS/INV/${stamp}/0001`, `EIS/INV/${stamp}/0002`],
      jobs: [`EIS/INV/${stamp}/0003`, `EIS/INV/${stamp}/0004`],
    });
    expect(await nextAvailableInvoiceNumber(tx, "org-collision-d")).toBe(`EIS/INV/${stamp}/0005`);
  });
});
