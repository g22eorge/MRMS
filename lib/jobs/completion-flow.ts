// @ts-nocheck
import type { JobStatus } from "@prisma/client";

export type CompletionFlowStep = 1 | 2 | 3;

export function shouldOpenJobCompletionFlow(args: {
  statusChangedTo?: JobStatus;
  canManageFinancials: boolean;
  clientBill?: number | null;
}): boolean {
  return (
    args.statusChangedTo === "COMPLETED" &&
    args.canManageFinancials &&
    typeof args.clientBill === "number" &&
    args.clientBill > 0
  );
}

export function initialCompletionFlowStep(args: {
  hasInvoice: boolean;
  canSendWhatsApp: boolean;
  balanceDue: number;
}): CompletionFlowStep {
  if (!args.hasInvoice) return 1;
  if (args.canSendWhatsApp) return 2;
  return 3;
}

export function completionFlowStepLabels(canSendWhatsApp: boolean): readonly [string, string, string] {
  return canSendWhatsApp
    ? ["Issue invoice", "Send via WhatsApp", "Record payment"]
    : ["Issue invoice", "Invoice ready", "Record payment"];
}
