import { describe, expect, it } from "bun:test";

import {
  completionFlowStepLabels,
  initialCompletionFlowStep,
  shouldOpenJobCompletionFlow,
} from "../../lib/jobs/completion-flow";

describe("shouldOpenJobCompletionFlow()", () => {
  it("opens when job completes with bill and financial permissions", () => {
    expect(
      shouldOpenJobCompletionFlow({
        statusChangedTo: "COMPLETED",
        canManageFinancials: true,
        clientBill: 150000,
      }),
    ).toBe(true);
  });

  it("does not open for other status changes", () => {
    expect(
      shouldOpenJobCompletionFlow({
        statusChangedTo: "READY_FOR_PICKUP",
        canManageFinancials: true,
        clientBill: 150000,
      }),
    ).toBe(false);
  });

  it("requires financial permissions and a positive bill", () => {
    expect(
      shouldOpenJobCompletionFlow({
        statusChangedTo: "COMPLETED",
        canManageFinancials: false,
        clientBill: 150000,
      }),
    ).toBe(false);
    expect(
      shouldOpenJobCompletionFlow({
        statusChangedTo: "COMPLETED",
        canManageFinancials: true,
        clientBill: 0,
      }),
    ).toBe(false);
  });
});

describe("initialCompletionFlowStep()", () => {
  it("starts at invoice when none exists", () => {
    expect(
      initialCompletionFlowStep({ hasInvoice: false, canSendWhatsApp: true, balanceDue: 100 }),
    ).toBe(1);
  });

  it("skips to WhatsApp when invoice exists and phone is available", () => {
    expect(
      initialCompletionFlowStep({ hasInvoice: true, canSendWhatsApp: true, balanceDue: 100 }),
    ).toBe(2);
  });

  it("skips WhatsApp step when no phone", () => {
    expect(
      initialCompletionFlowStep({ hasInvoice: true, canSendWhatsApp: false, balanceDue: 100 }),
    ).toBe(3);
  });
});

describe("completionFlowStepLabels()", () => {
  it("includes WhatsApp label when phone is available", () => {
    expect(completionFlowStepLabels(true)[1]).toBe("Send via WhatsApp");
  });

  it("uses neutral middle label without phone", () => {
    expect(completionFlowStepLabels(false)[1]).toBe("Invoice ready");
  });
});
