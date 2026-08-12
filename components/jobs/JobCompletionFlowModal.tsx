"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  issueJobInvoiceAction,
  recordClientPaymentAction,
  sendInvoiceViaWhatsAppAction,
} from "@/app/(app)/jobs/[id]/actions";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { PAYMENT_METHODS, formatPaymentMethodLabel } from "@/lib/constants/payment-methods";
import { formatMoney } from "@/lib/currency";
import {
  completionFlowStepLabels,
  initialCompletionFlowStep,
  type CompletionFlowStep,
} from "@/lib/jobs/completion-flow";

type Props = {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
  clientName?: string | null;
  clientPhone?: string | null;
  clientBill: number;
  balanceDue: number;
  baseCurrency: string;
  initialInvoiceNumber?: string | null;
  onOpenFinancials?: () => void;
};

export function JobCompletionFlowModal({
  open,
  onClose,
  jobId,
  jobNumber,
  clientName,
  clientPhone,
  clientBill,
  balanceDue,
  baseCurrency,
  initialInvoiceNumber,
  onOpenFinancials,
}: Props) {
  const router = useRouter();
  const canSendWhatsApp = Boolean(clientPhone?.trim());
  const stepLabels = completionFlowStepLabels(canSendWhatsApp);

  const [step, setStep] = useState<CompletionFlowStep>(1);
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber?.trim() ?? "");
  const [invoiceIssued, setInvoiceIssued] = useState(Boolean(initialInvoiceNumber?.trim()));
  const [whatsAppSent, setWhatsAppSent] = useState(false);
  const [isInvoicePending, startInvoiceTransition] = useTransition();
  const [isWhatsAppPending, startWhatsAppTransition] = useTransition();
  const [isPaymentPending, startPaymentTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const hasInvoice = Boolean(initialInvoiceNumber?.trim());
    setInvoiceNumber(initialInvoiceNumber?.trim() ?? "");
    setInvoiceIssued(hasInvoice);
    setWhatsAppSent(false);
    setStep(
      initialCompletionFlowStep({
        hasInvoice,
        canSendWhatsApp,
        balanceDue,
      }),
    );
  }, [open, initialInvoiceNumber, canSendWhatsApp, balanceDue]);

  function handleIssueInvoice() {
    startInvoiceTransition(async () => {
      const res = await issueJobInvoiceAction(jobId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setInvoiceNumber(res.invoiceNumber);
      setInvoiceIssued(true);
      toast.success(`Invoice ${res.invoiceNumber} issued`);
      setStep(canSendWhatsApp ? 2 : 3);
      router.refresh();
    });
  }

  function handleSendWhatsApp() {
    startWhatsAppTransition(async () => {
      const res = await sendInvoiceViaWhatsAppAction(jobId);
      if (!res.success) {
        toast.error(res.error ?? "Failed to send invoice");
        return;
      }
      setWhatsAppSent(true);
      toast.success("Invoice queued for WhatsApp delivery");
      setStep(3);
      router.refresh();
    });
  }

  function handleRecordPayment(form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set("jobId", jobId);
    fd.set("currency", baseCurrency);
    if (baseCurrency !== "UGX") {
      const rate = fd.get("exchangeRateToBase");
      if (!rate) fd.set("exchangeRateToBase", "1");
    } else {
      fd.set("exchangeRateToBase", "1");
    }

    startPaymentTransition(async () => {
      const res = await recordClientPaymentAction(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Payment recorded");
      onClose();
      router.refresh();
    });
  }

  const defaultPaymentAmount = balanceDue > 0 ? balanceDue.toFixed(2) : clientBill.toFixed(2);

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel="Job completion billing flow">
      <ModalHeader
        title="Complete billing"
        subtitle={`${jobNumber}${clientName ? ` · ${clientName}` : ""}`}
        onClose={onClose}
      />

      <div className="space-y-5 p-4">
        <p className="text-sm text-[var(--ink-muted)]">
          Job marked complete. Issue the invoice, share it with the client, then record payment when it arrives.
        </p>

        <ol className="grid gap-2 sm:grid-cols-3">
          {stepLabels.map((label, index) => {
            const stepNumber = (index + 1) as CompletionFlowStep;
            const done =
              (stepNumber === 1 && invoiceIssued) ||
              (stepNumber === 2 && (whatsAppSent || (invoiceIssued && !canSendWhatsApp))) ||
              (stepNumber === 3 && balanceDue <= 0);
            const active = step === stepNumber;

            return (
              <li
                key={label}
                className={`rounded-lg border px-3 py-2 text-center text-xs ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : done
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
                }`}
              >
                <span className="block text-[0.625rem] font-bold uppercase tracking-wider">Step {stepNumber}</span>
                <span className="mt-0.5 block font-semibold">{label}</span>
              </li>
            );
          })}
        </ol>

        {step === 1 ? (
          <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">Issue invoice</p>
            <p className="text-sm text-[var(--ink-muted)]">
              Bill amount: <span className="font-semibold text-[var(--ink)]">{formatMoney(clientBill, baseCurrency)}</span>
            </p>
            {invoiceIssued && invoiceNumber ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Invoice {invoiceNumber} is on file.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isInvoicePending}
                onClick={handleIssueInvoice}
                className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {isInvoicePending ? "Issuing…" : invoiceIssued ? "Re-issue invoice" : "Issue invoice"}
              </button>
              {invoiceIssued ? (
                <a
                  href={`/api/jobs/${jobId}/invoice`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-premium-secondary rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  Download PDF
                </a>
              ) : null}
              {invoiceIssued ? (
                <button
                  type="button"
                  onClick={() => setStep(canSendWhatsApp ? 2 : 3)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  Continue →
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">Send invoice via WhatsApp</p>
            {canSendWhatsApp ? (
              <>
                <p className="text-sm text-[var(--ink-muted)]">
                  Send {invoiceNumber ? `invoice ${invoiceNumber}` : "the invoice"} to{" "}
                  <span className="font-medium text-[var(--ink)]">{clientPhone}</span>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isWhatsAppPending}
                    onClick={handleSendWhatsApp}
                    className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {isWhatsAppPending ? "Sending…" : whatsAppSent ? "Send again" : "Send via WhatsApp"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  >
                    Skip for now →
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--ink-muted)]">
                  No client phone number on this job. You can share the PDF manually or add a phone on the client record.
                </p>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-premium-secondary rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  Continue to payment →
                </button>
              </>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">Record payment</p>
            {balanceDue <= 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                This job is fully paid ({formatMoney(clientBill, baseCurrency)} received).
              </p>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">
                Balance due:{" "}
                <span className="font-semibold text-[var(--ink)]">{formatMoney(balanceDue, baseCurrency)}</span>
              </p>
            )}

            {balanceDue > 0 ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleRecordPayment(event.currentTarget);
                }}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[0.75rem] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                      Amount
                    </label>
                    <input
                      name="amount"
                      defaultValue={defaultPaymentAmount}
                      inputMode="decimal"
                      required
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.8125rem]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[0.75rem] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                      Method
                    </label>
                    <select
                      name="method"
                      defaultValue="CASH"
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.8125rem]"
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {formatPaymentMethodLabel(method)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <input type="hidden" name="kind" value="BALANCE" />
                <div>
                  <label className="mb-1 block text-[0.75rem] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                    Reference / receipt #
                  </label>
                  <input
                    name="reference"
                    placeholder="Optional"
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.8125rem]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isPaymentPending}
                  className="btn-premium w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {isPaymentPending ? "Recording…" : "Record payment"}
                </button>
              </form>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Done
              </button>
              {onOpenFinancials ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFinancials();
                  }}
                  className="btn-premium-secondary rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  Open financials
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
