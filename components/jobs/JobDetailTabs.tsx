"use client";

import { Role } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { markMessagesReadAction, sendManualReplyAction, sendQuotationViaWhatsAppAction, sendInvoiceViaWhatsAppAction, sendJobCardViaWhatsAppAction, sendQuotationViaEmailAction, sendInvoiceViaEmailAction, sendJobCardViaEmailAction, updateJobAction, updateOneTimeExternalAssignmentAction, recordClientPaymentAction, recordTechnicianPayoutAction } from "@/app/(app)/jobs/[id]/actions";
import { CheckboxField, LineItemTotals } from "@/components/forms";
import { DataTable } from "@/components/ui/DataTable";
import { JobCompletionFlowModal } from "@/components/jobs/JobCompletionFlowModal";
import { JobDocumentTimeline } from "@/components/jobs/JobDocumentTimeline";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import type { BadgeTone } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AuditTimeline } from "@/components/shared/AuditTimeline";
import { PhotoUploader } from "@/components/shared/PhotoUploader";
import { resolveTechCost } from "@/lib/billing";
import { formatEATDateTime } from "@/lib/date-eat";
import { canGenerateInvoiceForStatus, canGenerateQuotationForStatus } from "@/lib/documents";
import { JobStatus, normalizeJobStatus } from "@/lib/job-status";
import { shouldOpenJobCompletionFlow } from "@/lib/jobs/completion-flow";
import type { JobDocumentTimelineEntry } from "@/lib/jobs/job-document-timeline-shared";
import { can } from "@/lib/permissions";

const tabs = ["overview", "client", "diagnosis", "repair", "financials", "documents", "timeline", "photos", "messages"] as const;

function formatUtcDateTime(value: Date | string) {
  return formatEATDateTime(value);
}

function formatBillAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function prettyEnum(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

// Job status → RecordActionBar pill tone (mirrors JobStatusBadge colors).
const JOB_BAR_TONE: Record<ReturnType<typeof normalizeJobStatus>, BadgeTone> = {
  RECEIVED: "neutral",
  DIAGNOSING: "info",
  REFERRED: "violet",
  AWAITING_APPROVAL: "warning",
  IN_REPAIR: "success",
  READY_FOR_PICKUP: "accent",
  COMPLETED: "success",
  CLOSED: "neutral",
};

function communicationLabel(value: Props["job"]["communicationStatus"]) {
  if (!value || value === "NONE") return "No update yet";
  if (value === "AWAITING_RESPONSE") return "Awaiting client response";
  if (value === "APPROVED") return "Client approved";
  if (value === "DECLINED") return "Client declined";
  return prettyEnum(value);
}

function recommendationLabel(value: Props["job"]["recommendationOption"]) {
  if (!value) return "Not set";
  if (value === "PROCEED_REPAIR") return "Proceed with repair";
  if (value === "REPLACE_DEVICE") return "Replace device";
  if (value === "RETURN_UNREPAIRED") return "Return unrepaired";
  return prettyEnum(value);
}

function hoursSince(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)));
}

function previewText(value: string | null | undefined, max = 240) {
  if (!value) return "-";
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function statusWatchLabel(status: JobStatus, ageHours: number) {
  if (status === "AWAITING_APPROVAL" && ageHours >= 24) return "Client response delayed";
  if (status === "DIAGNOSING" && ageHours >= 12) return "Diagnosis aging";
  if (status === "RECEIVED" && ageHours >= 8) return "Needs triage";
  if (status === "IN_REPAIR" && ageHours >= 48) return "Repair duration high";
  if (status === "READY_FOR_PICKUP" && ageHours >= 24) return "Pickup follow-up due";
  return null;
}

const panelShellClass =
  "panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden p-5";
const softSectionClass =
  "space-y-3 rounded-xl bg-[var(--panel-strong)] p-3";
const fieldClass =
  "w-full rounded-lg bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/14";
const areaClass =
  "min-h-24 w-full rounded-lg bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/14";

type InboundMsg = {
  id: string;
  from: string;
  body: string | null;
  mediaType: string | null;
  mediaCaption: string | null;
  timestamp: Date;
  isRead: boolean;
};

type OutboundMsg = {
  id: string;
  to: string;
  body: string;
  type: string;
  sentAt: Date | null;
  createdAt: Date;
  providerDeliveryStatus: string | null;
};

type ThreadEntry =
  | { kind: "inbound"; msg: InboundMsg; sortAt: Date }
  | { kind: "outbound"; msg: OutboundMsg; sortAt: Date };

function formatMsgTime(d: Date) {
  return new Intl.DateTimeFormat("en-UG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function DeliveryDot({ status }: { status: string | null }) {
  if (!status) return null;
  const color =
    status === "read" ? "text-blue-500"
    : status === "delivered" ? "text-emerald-500"
    : status === "sent" ? "text-[var(--ink-muted)]"
    : status === "failed" ? "text-red-500"
    : "text-[var(--ink-muted)]";
  return (
    <span className={`text-[12px] font-medium ${color}`} title={status}>
      {status === "read" ? "Read" : status === "delivered" ? "Delivered" : status === "sent" ? "Sent" : status === "failed" ? "Failed" : status}
    </span>
  );
}

function MessagesTab({
  jobId,
  clientPhone,
  clientEmail,
  canSendQuote,
  canSendInvoice,
  canSendJobCard,
  inbound,
  outbound,
}: {
  jobId: string;
  clientPhone: string | null | undefined;
  clientEmail: string | null | undefined;
  canSendQuote: boolean;
  canSendInvoice: boolean;
  canSendJobCard: boolean;
  inbound: InboundMsg[];
  outbound: OutboundMsg[];
}) {
  const router = useRouter();
  const [isMarkingRead, startMarkReadTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const [isSendingQuote, startSendQuoteTransition] = useTransition();
  const [isSendingInvoice, startSendInvoiceTransition] = useTransition();
  const [isSendingJobCard, startSendJobCardTransition] = useTransition();
  const [isEmailingQuote, startEmailQuoteTransition] = useTransition();
  const [isEmailingInvoice, startEmailInvoiceTransition] = useTransition();
  const [isEmailingJobCard, startEmailJobCardTransition] = useTransition();
  const [replyText, setReplyText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [jobCardError, setJobCardError] = useState<string | null>(null);

  function emailSend(
    action: (id: string) => Promise<{ success: boolean; error?: string }>,
    start: React.TransitionStartFunction,
    setErr: (v: string | null) => void,
    fallback: string,
  ) {
    setErr(null);
    start(async () => {
      const res = await action(jobId);
      if (res.success) router.refresh();
      else setErr(res.error ?? fallback);
    });
  }

  const thread: ThreadEntry[] = [
    ...inbound.map((msg) => ({ kind: "inbound" as const, msg, sortAt: new Date(msg.timestamp) })),
    ...outbound.map((msg) => ({ kind: "outbound" as const, msg, sortAt: new Date(msg.sentAt ?? msg.createdAt) })),
  ].sort((a, b) => a.sortAt.getTime() - b.sortAt.getTime());

  const unread = inbound.filter((m) => !m.isRead);

  function handleMarkRead() {
    startMarkReadTransition(async () => {
      await markMessagesReadAction(jobId);
      router.refresh();
    });
  }

  function handleSend() {
    if (!replyText.trim()) return;
    setSendError(null);
    startSendTransition(async () => {
      const res = await sendManualReplyAction(jobId, replyText);
      if (res.success) {
        setReplyText("");
        router.refresh();
      } else {
        setSendError(res.error ?? "Failed to send");
      }
    });
  }

  function handleSendQuote() {
    setQuoteError(null);
    startSendQuoteTransition(async () => {
      const res = await sendQuotationViaWhatsAppAction(jobId);
      if (res.success) {
        router.refresh();
      } else {
        setQuoteError(res.error ?? "Failed to send quotation");
      }
    });
  }

  function handleSendInvoice() {
    setInvoiceError(null);
    startSendInvoiceTransition(async () => {
      const res = await sendInvoiceViaWhatsAppAction(jobId);
      if (res.success) {
        router.refresh();
      } else {
        setInvoiceError(res.error ?? "Failed to send invoice");
      }
    });
  }

  function handleSendJobCard() {
    setJobCardError(null);
    startSendJobCardTransition(async () => {
      const res = await sendJobCardViaWhatsAppAction(jobId);
      if (res.success) {
        router.refresh();
      } else {
        setJobCardError(res.error ?? "Failed to send job card");
      }
    });
  }

  return (
    <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
          Messages
        </p>
        {unread.length > 0 ? (
          <button
            type="button"
            disabled={isMarkingRead}
            onClick={handleMarkRead}
            className="rounded-lg bg-[var(--panel-strong)] px-3 py-1 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50 disabled:opacity-50"
          >
            Mark {unread.length} as read
          </button>
        ) : null}
      </div>

      {thread.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-[var(--ink-muted)]">
          No messages yet. Outbound notifications and client replies will appear here.
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-4">
          {thread.map((entry) => {
            if (entry.kind === "outbound") {
              const m = entry.msg;
              return (
                <div key={m.id} className="flex flex-col items-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--accent)] px-3.5 py-2.5 text-sm text-white shadow-sm">
                    <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                    <span>{formatMsgTime(m.sentAt ?? m.createdAt)}</span>
                    {m.type === "STAFF_REPLY" ? (
                      <span className="text-[var(--ink-muted)]">staff reply</span>
                    ) : (
                      <span className="capitalize text-[var(--ink-muted)]">
                        {m.type.replaceAll("_", " ").toLowerCase()}
                      </span>
                    )}
                    <DeliveryDot status={m.providerDeliveryStatus} />
                  </div>
                </div>
              );
            } else {
              const m = entry.msg;
              return (
                <div key={m.id} className="flex flex-col items-start">
                  <div className={`max-w-[80%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm shadow-sm ${m.isRead ? "bg-[var(--panel-strong)] text-[var(--ink)]" : "bg-[var(--panel-strong)] text-[var(--ink)] ring-2 ring-[var(--accent)]/30"}`}>
                    {m.body ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    ) : m.mediaType ? (
                      <p className="italic text-[var(--ink-muted)]">
                        [{m.mediaType}]{m.mediaCaption ? `: ${m.mediaCaption}` : ""}
                      </p>
                    ) : (
                      <p className="italic text-[var(--ink-muted)]">[message]</p>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                    <span>{m.from}</span>
                    <span>{formatMsgTime(m.timestamp)}</span>
                    {!m.isRead ? (
                      <span className="font-semibold text-[var(--accent)]">unread</span>
                    ) : null}
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}

      {clientPhone || clientEmail ? (
        <div className="border-t border-[var(--line)] p-3 space-y-2">
          {(canSendQuote || canSendInvoice || canSendJobCard) ? (
            <div className="flex flex-wrap items-center gap-2">
              {canSendQuote ? (
                <>
                  {clientPhone ? (
                    <button type="button" onClick={handleSendQuote} disabled={isSendingQuote} className="btn-premium-secondary rounded-xl px-3 py-1.5 text-sm disabled:opacity-50">
                      {isSendingQuote ? "Sending…" : "WhatsApp quote"}
                    </button>
                  ) : null}
                  {clientEmail ? (
                    <button type="button" onClick={() => emailSend(sendQuotationViaEmailAction, startEmailQuoteTransition, setQuoteError, "Failed to email quotation")} disabled={isEmailingQuote} className="btn-premium-secondary rounded-xl px-3 py-1.5 text-sm disabled:opacity-50">
                      {isEmailingQuote ? "Emailing…" : "Email quote"}
                    </button>
                  ) : null}
                  {quoteError ? <p className="text-xs text-red-600">{quoteError}</p> : null}
                </>
              ) : null}
              {canSendInvoice ? (
                <>
                  {clientPhone ? (
                    <button type="button" onClick={handleSendInvoice} disabled={isSendingInvoice} className="btn-premium-secondary rounded-xl px-3 py-1.5 text-sm disabled:opacity-50">
                      {isSendingInvoice ? "Sending…" : "WhatsApp invoice"}
                    </button>
                  ) : null}
                  {clientEmail ? (
                    <button type="button" onClick={() => emailSend(sendInvoiceViaEmailAction, startEmailInvoiceTransition, setInvoiceError, "Failed to email invoice")} disabled={isEmailingInvoice} className="btn-premium-secondary rounded-xl px-3 py-1.5 text-sm disabled:opacity-50">
                      {isEmailingInvoice ? "Emailing…" : "Email invoice"}
                    </button>
                  ) : null}
                  {invoiceError ? <p className="text-xs text-red-600">{invoiceError}</p> : null}
                </>
              ) : null}
              {canSendJobCard ? (
                <>
                  {clientPhone ? (
                    <button type="button" onClick={handleSendJobCard} disabled={isSendingJobCard} className="btn-premium-secondary rounded-xl px-3 py-1.5 text-sm disabled:opacity-50">
                      {isSendingJobCard ? "Sending…" : "WhatsApp job card"}
                    </button>
                  ) : null}
                  {clientEmail ? (
                    <button type="button" onClick={() => emailSend(sendJobCardViaEmailAction, startEmailJobCardTransition, setJobCardError, "Failed to email job card")} disabled={isEmailingJobCard} className="btn-premium-secondary rounded-xl px-3 py-1.5 text-sm disabled:opacity-50">
                      {isEmailingJobCard ? "Emailing…" : "Email job card"}
                    </button>
                  ) : null}
                  {jobCardError ? <p className="text-xs text-red-600">{jobCardError}</p> : null}
                </>
              ) : null}
            </div>
          ) : null}
          {clientPhone ? (
            <>
              <div className="flex gap-2 items-end">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  disabled={isSending}
                  className="min-h-[60px] flex-1 resize-none rounded-xl bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/14 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending || !replyText.trim()}
                  className="btn-premium shrink-0 rounded-xl px-4 py-2 text-sm disabled:opacity-50"
                >
                  {isSending ? "Sending…" : "Send"}
                </button>
              </div>
              {sendError ? <p className="text-xs text-red-600">{sendError}</p> : null}
              <p className="text-[12px] text-[var(--ink-muted)]">Sending to {clientPhone}</p>
            </>
          ) : (
            <p className="text-[12px] text-[var(--ink-muted)]">No phone number on file — documents above can still be emailed; a WhatsApp reply needs a phone.</p>
          )}
        </div>
      ) : (
        <div className="border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--ink-muted)]">
          No client phone or email — cannot send.
        </div>
      )}
    </div>
  );
}

type Props = {
  role: Role;
  permissions?: string[];
  orgBaseCurrency: string;
  supportedCurrencies: string[];
  returnTo?: string;
  returnLabel?: string;
  initialTab?: string;
  documentTimeline?: JobDocumentTimelineEntry[];
  technicians: Array<{
    id: string;
    name: string;
    role: Role;
  }>;
  deviceHistory?: Array<{
    id: string;
    jobNumber: string;
    status: JobStatus;
    receivedAt: Date;
    completedAt: Date | null;
    updatedAt: Date;
  }>;
  job: {
    id: string;
    clientId?: string | null;
    jobNumber: string;
    status: JobStatus;
    deviceType: string;
    brand: string;
    model: string;
    issueDescription: string;
    serviceType?: "HARDWARE" | "SOFTWARE" | "BOTH" | null;
    softwareOsInstall?: boolean;
    softwareDriversUpdates?: boolean;
    softwareDataBackupRestore?: boolean;
    softwareAccountSetup?: boolean;
    softwarePerformanceTune?: boolean;
    softwareThirdPartyApps?: boolean;
    softwareRequestedNotes?: string | null;
    softwareLicenseAttested?: boolean;
    softwareInstallerSource?:
      | "CLIENT_PROVIDED_INSTALLER"
      | "CLIENT_ACCOUNT_LOGIN"
      | "COMPANY_LICENSE"
      | "OPEN_SOURCE"
      | "OTHER"
      | null;
    softwareInstallerSourceNote?: string | null;
    workflowReason?:
      | "NONE"
      | "PARTS_PENDING"
      | "SPECIALIST_ESCALATION"
      | "CLIENT_DECLINED"
      | "UNREPAIRABLE"
      | "CUSTOMER_CANCELLED"
      | "OTHER"
      | null;
    statusNote?: string | null;
    updatedAt: Date;
    completedAt?: Date | null;
    deliveredAt?: Date | null;
    deliveryMethod?: "PICKUP" | "DELIVERY" | "COURIER" | null;
    deliveredTo?: string | null;
    repairPath: "IN_HOUSE" | "EXTERNAL" | null;
    diagnosisNotes: string | null;
    externalDiagnosis: string | null;
    recommendationOption?:
      | "PROCEED_REPAIR"
      | "REPLACE_DEVICE"
      | "RETURN_UNREPAIRED"
      | null;
    communicationStatus?:
      | "NONE"
      | "AWAITING_RESPONSE"
      | "APPROVED"
      | "DECLINED"
      | null;
    clientConversationNote?: string | null;
    lastClientContactAt?: Date | null;
    partsNeeded: string | null;
    workDone: string | null;
    partsReplaced: string | null;
    externalTechBill: number | null;
    clientBill: number | null;
    clientPaid?: boolean;
    clientPaidAt?: Date | null;
    clientPaymentRef?: string | null;
    invoiceNumber?: string | null;
    vatApplicable?: boolean;
    externalTechFee?: number | null;
    externalPaid?: boolean;
    externalPaidAt?: Date | null;
    externalPaymentRef?: string | null;
    repairTimeline: string | null;
    timelineMinMinutes?: number | null;
    timelineMaxMinutes?: number | null;
    timelineConfidence?: "FIRM" | "ESTIMATED" | "PARTS_DEPENDENT" | null;
    timelineNote?: string | null;
    assignedTo?: { id: string; name: string; role: Role } | null;
    client?: { fullName: string; phone: string; email: string | null } | null;
    clientPayments?: Array<{
      id: string;
      amount: number;
      kind: string;
      method: string;
      reference: string | null;
      note: string | null;
      receivedAt: Date;
      createdBy: { name: string } | null;
    }>;
    technicianPayouts?: Array<{
      id: string;
      amount: number;
      method: string;
      reference: string | null;
      note: string | null;
      paidAt: Date;
      recordedBy: { name: string } | null;
    }>;
    auditLogs: Array<{
      id: string;
      action: string;
      detail: string | null;
      createdAt: Date;
      user: { name: string };
    }>;
    photos: Array<{ id: string; url: string; label: string | null; visibility?: string | null }>;
    inboundMessages?: Array<{
      id: string;
      from: string;
      body: string | null;
      mediaType: string | null;
      mediaCaption: string | null;
      timestamp: Date;
      isRead: boolean;
    }>;
    outboundMessages?: Array<{
      id: string;
      to: string;
      body: string;
      type: string;
      sentAt: Date | null;
      createdAt: Date;
      providerDeliveryStatus: string | null;
    }>;
    oneTimeExternalAssignment?: {
      technicianName: string;
      phone: string;
      specialization: string | null;
      agreedRepairCost: number | null;
      expectedPartsCost: number | null;
      partsNotes: string | null;
      assignedAt: Date;
      expectedReturnAt: Date | null;
      returnedAt: Date | null;
      instructions: string | null;
      progressNotes: string | null;
      finalOutcome: string | null;
    } | null;
  };
  /** Server-rendered panels folded into the tab system instead of stacked below the page. */
  assessmentSlot?: ReactNode;
  moveSlot?: ReactNode;
  portalSlot?: ReactNode;
};

export function JobDetailTabs({ role, permissions = [], orgBaseCurrency, job, technicians, deviceHistory = [], returnTo = "/jobs", initialTab, documentTimeline = [], assessmentSlot, moveSlot, portalSlot }: Props) {
  const inboundMessages = job.inboundMessages ?? [];
  const outboundMessages = job.outboundMessages ?? [];
  const unreadCount = inboundMessages.filter((m) => !m.isRead).length;
  const router = useRouter();
  const tabToSegment = (t: string): "work" | "money" | "history" =>
    t === "financials" || t === "documents"
      ? "money"
      : t === "photos" || t === "messages"
        ? "history"
        : "work";
  const [segment, setSegment] = useState<"work" | "money" | "history" | "assessment">(() =>
    initialTab ? tabToSegment(initialTab) : "work",
  );
  // Back-compat shim: existing setActive("financials")-style calls route to the right segment.
  const setActive = (t: string) => setSegment(tabToSegment(t));
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  // Live billing editor state so the VAT breakdown recomputes as you type/toggle
  // (before saving). Saved figures elsewhere still read from `job`.
  const [billInput, setBillInput] = useState<string>(job.clientBill != null ? String(job.clientBill) : "");
  const [vatInput, setVatInput] = useState<boolean>(job.vatApplicable ?? false);
  const [showOneTimeForm, setShowOneTimeForm] = useState(false);
  const [isDiagnosisPending, startDiagnosisTransition] = useTransition();
  const [isOneTimeExternalPending, startOneTimeExternalTransition] = useTransition();
  const [isRepairPending, startRepairTransition] = useTransition();
  const [isFinancialPending, startFinancialTransition] = useTransition();
  const [isCommunicationPending, startCommunicationTransition] = useTransition();
  const [isStatusPending, startStatusTransition] = useTransition();
  const [confirmClose, setConfirmClose] = useState(false);
  const [completionFlowOpen, setCompletionFlowOpen] = useState(false);
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [showPayoutForm, setShowPayoutForm] = useState(false);

  useEffect(() => {
    if (!savedSection) return;
    const timer = setTimeout(() => setSavedSection(null), 2000);
    return () => clearTimeout(timer);
  }, [savedSection]);
  const permissionUser = { role, permissions };
  const canViewFinancials = can.viewFinancials(permissionUser);
  const canManageFinancials = can.approveInvoices(permissionUser);
  const canGenerateJobCard = can.generateJobCards(permissionUser);
  const canGenerateQuotation =
    ["ADMIN", "OPS", "TECHNICIAN_INTERNAL"].includes(role) ||
    canViewFinancials ||
    can.viewApprovedCost(permissionUser);
  const canGenerateInvoice = ["ADMIN", "OPS"].includes(role) || canManageFinancials;
  const canViewJobDocuments =
    canViewFinancials ||
    canGenerateJobCard ||
    canGenerateQuotation ||
    ["ADMIN", "OPS", "FRONT_DESK", "SALES", "SALES_MANAGER"].includes(role);

  const isSoftwareJob = (job.serviceType ?? "HARDWARE") !== "HARDWARE";
  const canManagePayouts = role === "ADMIN" || can.reviewExternalBills(permissionUser);
  const canAssignJobs = can.assignJobs(permissionUser);
  const canUpdateClientCommunication = can.approveWork(permissionUser);
  const isIntake = role === "FRONT_DESK";

  function handleStatusUpdateResult(
    res: { error?: string; statusChangedTo?: JobStatus },
    explicitNextStatus?: JobStatus,
  ) {
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Status updated");
    setSavedSection("status");
    const changedTo = res.statusChangedTo ?? explicitNextStatus;
    if (
      shouldOpenJobCompletionFlow({
        statusChangedTo: changedTo,
        canManageFinancials,
        clientBill: job.clientBill,
      })
    ) {
      setCompletionFlowOpen(true);
    }
    router.refresh();
  }

  const visibleTabs = tabs.filter((tab) => {
    if (tab === "client") return role !== "TECHNICIAN_EXTERNAL";
    if (tab === "financials") return canViewFinancials;
    if (tab === "documents") return canViewJobDocuments;
    if (tab === "timeline") return ["ADMIN", "OPS", "FRONT_DESK"].includes(role) || can.viewClientInfo(permissionUser);
    if ((tab === "diagnosis" || tab === "repair") && isIntake) return false;
    if (tab === "messages") return ["ADMIN", "OPS", "FRONT_DESK"].includes(role);
    return true;
  });

  const allowedStatusTransitions: Partial<Record<JobStatus, JobStatus[]>> = {
    RECEIVED: ["DIAGNOSING"],
    DIAGNOSING: ["REFERRED", "IN_REPAIR"],
    REFERRED: ["PENDING_EXTERNAL_ASSIGNMENT", "ASSIGNED_ONE_TIME_EXTERNAL", "IN_EXTERNAL_REPAIR", "AWAITING_APPROVAL"],
    PENDING_EXTERNAL_ASSIGNMENT: ["ASSIGNED_ONE_TIME_EXTERNAL", "IN_EXTERNAL_REPAIR", "AWAITING_APPROVAL"],
    ASSIGNED_ONE_TIME_EXTERNAL: ["IN_EXTERNAL_REPAIR", "AWAITING_APPROVAL"],
    IN_EXTERNAL_REPAIR: ["RETURNED_FROM_EXTERNAL", "AWAITING_APPROVAL"],
    RETURNED_FROM_EXTERNAL: ["AWAITING_APPROVAL", "IN_REPAIR"],
    AWAITING_APPROVAL: ["IN_REPAIR", "CLOSED"],
    IN_REPAIR: ["WAITING_FOR_PARTS", "READY_FOR_PICKUP", "COMPLETED", "CLOSED"],
    WAITING_FOR_PARTS: ["IN_REPAIR", "CLOSED"],
    READY_FOR_PICKUP: ["DELIVERED", "COMPLETED", "CLOSED"],
    DELIVERED: ["COMPLETED"],
    COMPLETED: [],
    CLOSED: [],
  };

  const statusKey = normalizeJobStatus(job.status);
  const statusActions = allowedStatusTransitions[job.status] ?? allowedStatusTransitions[statusKey] ?? [];
  const isTerminal = job.status === "COMPLETED" || job.status === "CLOSED";
  const existingMargin =
    typeof job.clientBill === "number"
      ? job.clientBill - resolveTechCost(job.externalTechFee, job.externalTechBill)
      : null;
  const vatApplicable = job.vatApplicable ?? false;
  const clientBillValue = typeof job.clientBill === "number" ? job.clientBill : 0;
  const clientPayments = job.clientPayments ?? [];
  const totalClientPaid = clientPayments.reduce((sum, payment) => sum + (payment.kind === "REFUND" ? -1 : 1) * payment.amount, 0);
  const clientBalanceDue = clientBillValue - totalClientPaid;
  const paymentStatus =
    clientBillValue <= 0
      ? "No bill set"
      : totalClientPaid <= 0
        ? "Unpaid"
        : totalClientPaid < clientBillValue
          ? "Partially paid"
          : totalClientPaid === clientBillValue
            ? "Paid"
            : "Overpaid";
  const technicianPayouts = job.technicianPayouts ?? [];
  const technicianCost = resolveTechCost(job.externalTechFee, job.externalTechBill);
  const technicianPaidFromHistory = technicianPayouts.reduce((sum, payout) => sum + payout.amount, 0);
  const technicianPaid = Math.max(technicianPaidFromHistory, job.externalPaid && technicianCost > 0 ? technicianCost : 0);
  const technicianBalance = technicianCost - technicianPaid;
  const technicianPayoutStatus =
    technicianCost <= 0
      ? "No cost set"
      : technicianPaid <= 0
        ? "Unpaid"
        : technicianPaid < technicianCost
          ? "Partially paid"
          : technicianPaid === technicianCost
            ? "Paid"
            : "Overpaid";
  const repairCostBeforeVat = vatApplicable ? clientBillValue / 1.18 : clientBillValue;
  const vatAmount = vatApplicable ? Math.max(clientBillValue - repairCostBeforeVat, 0) : 0;
  // Live editor figures (recompute instantly from the form inputs, pre-save).
  const liveBill = Number(billInput) || 0;
  const liveBaseBeforeVat = vatInput ? liveBill / 1.18 : liveBill;
  const liveVatAmount = vatInput ? Math.max(liveBill - liveBaseBeforeVat, 0) : 0;
  const hasPayoutControls = canManagePayouts && job.repairPath === "EXTERNAL";
  const quotationEligibleByStatus = canGenerateQuotationForStatus(job.status);
  const invoiceEligibleByStatus = canGenerateInvoiceForStatus(job.status);
  const showJobCardAction = canGenerateJobCard;
  const showQuotationAction = canGenerateQuotation && quotationEligibleByStatus;
  const showInvoiceAction = canGenerateInvoice && invoiceEligibleByStatus;
  const documentHints: string[] = [];

  if (!showJobCardAction && !showQuotationAction && !showInvoiceAction) {
    documentHints.push("No document action is currently available for your role on this job.");
  }
  if (canGenerateQuotation && !quotationEligibleByStatus) {
    documentHints.push("Quotation unlocks after diagnosis starts.");
  }
  if (canGenerateInvoice && !invoiceEligibleByStatus) {
    documentHints.push("Invoice unlocks at Ready for Pickup, Completed, or Closed.");
  }

  const mobilePrimaryAction =
    job.status === "COMPLETED"
      ? { type: "tab" as const, label: "Mark Paid / Close", tab: "financials" as const }
      : showInvoiceAction
        ? { type: "link" as const, label: "Generate Invoice", href: `/api/jobs/${job.id}/invoice` }
        : showQuotationAction
          ? { type: "link" as const, label: "Generate Quote", href: `/api/jobs/${job.id}/quotation` }
          : showJobCardAction
            ? { type: "link" as const, label: "Generate Job Card", href: `/api/jobs/${job.id}/job-card` }
            : null;

  const expectedUpdatedAt = new Date(job.updatedAt).toISOString();
  const assignedRole = job.assignedTo?.role;
  const diagnosisMode: "internal" | "external" =
    assignedRole === "TECHNICIAN_EXTERNAL"
      ? "external"
      : assignedRole
          ? "internal"
          : job.repairPath === "EXTERNAL"
            ? "external"
            : "internal";
  const derivedRepairPath = assignedRole
    ? diagnosisMode === "external"
      ? "EXTERNAL (from assigned technician)"
      : "IN_HOUSE (from assigned technician)"
    : job.repairPath === "EXTERNAL"
      ? "EXTERNAL — no technician assigned"
      : job.repairPath === "IN_HOUSE"
        ? "IN_HOUSE — no technician assigned"
        : "Not set";
  const repairCostLabel = "Technician Cost";
  const stageLabels = ["Intake", "Diagnosis", "Approval", "Repair", job.status === "CLOSED" ? "Closed" : "Complete"];
  const currentStageIndex =
    job.status === "RECEIVED"
      ? 0
      : job.status === "DIAGNOSING"
        ? 1
        : job.status === "AWAITING_APPROVAL"
          ? 2
          : (["REFERRED", "IN_REPAIR", "READY_FOR_PICKUP"] as JobStatus[]).includes(job.status)
            ? 3
            : 4;
  const nextActionByStatus: Record<ReturnType<typeof normalizeJobStatus>, string> = {
    RECEIVED: "Start diagnosis",
    DIAGNOSING: "Capture diagnosis and set repair path",
    REFERRED: "Capture referral notes and handoff details",
    AWAITING_APPROVAL: "Record client approval decision",
    IN_REPAIR: "Update repair log and progress",
    READY_FOR_PICKUP: "Confirm delivery to client",
    COMPLETED: "Archive and invoice follow-up only",
    CLOSED: "No further workflow action",
  };
  const statusAgeHours = hoursSince(job.updatedAt);
  const watchLabel = statusWatchLabel(job.status, statusAgeHours);
  const etaValue = job.repairTimeline
    ? `${job.repairTimeline}${job.timelineConfidence ? ` (${prettyEnum(job.timelineConfidence)})` : ""}`
    : "Not set";
  const clientDecision = communicationLabel(job.communicationStatus);
  const recommendation = recommendationLabel(job.recommendationOption);
  const assignedLabel = job.assignedTo?.name
    ? job.assignedTo.name
    : job.oneTimeExternalAssignment?.technicianName
      ? `One-time external: ${job.oneTimeExternalAssignment.technicianName}`
      : "No technician assigned yet.";
  // Delivery record (shown once captured at handover) — display only.
  const deliveryMethodLabel =
    job.deliveryMethod === "PICKUP" ? "Client pickup"
    : job.deliveryMethod === "DELIVERY" ? "We delivered"
    : job.deliveryMethod === "COURIER" ? "Courier"
    : null;
  const deliveryWhen = job.deliveredAt ?? job.completedAt ?? null;
  const deliveryDate = deliveryWhen
    ? new Date(deliveryWhen).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const hasDelivery = Boolean(job.deliveryMethod || job.deliveredTo);
  type AttentionItem = { label: string; action: string; tab: (typeof tabs)[number] };
  const attentionItems = [
    !job.repairTimeline ? { label: "ETA not set", action: "Add an ETA so the client knows when to expect progress.", tab: "timeline" as const } : null,
    (job.status === "AWAITING_APPROVAL" && (!job.communicationStatus || job.communicationStatus === "NONE" || job.communicationStatus === "AWAITING_RESPONSE")) ? { label: "Client decision not updated", action: "Record whether the client approved, declined, or still needs follow-up.", tab: "timeline" as const } : null,
    !job.lastClientContactAt ? { label: "Last client contact not recorded", action: "Add the latest client update or follow-up note.", tab: "timeline" as const } : null,
    !job.diagnosisNotes && !job.externalDiagnosis ? { label: "Diagnosis missing", action: "Capture the fault found and recommended next step.", tab: "diagnosis" as const } : null,
    !job.partsNeeded && ["DIAGNOSING", "IN_REPAIR", "WAITING_FOR_PARTS"].includes(job.status) ? { label: "Parts not recorded", action: "Record needed parts or confirm none are required.", tab: "diagnosis" as const } : null,
    job.status === "COMPLETED" && !job.invoiceNumber ? { label: "Completed but not invoiced", action: "Generate the client invoice.", tab: "financials" as const } : null,
    job.status === "COMPLETED" && clientBillValue > 0 && clientBalanceDue > 0 ? { label: "Completed but unpaid", action: "Follow up client payment or record received money.", tab: "financials" as const } : null,
    clientBillValue > 0 && clientBalanceDue > 0 ? { label: "Invoice/payment follow-up needed", action: "Client still has a balance due.", tab: "financials" as const } : null,
  ].filter(Boolean) as AttentionItem[];
  const quickOverviewGroups = [
    {
      title: "Job Status",
      rows: [
        ["Current status", prettyEnum(job.status)],
        ["Next action", nextActionByStatus[statusKey]],
        ["ETA", etaValue],
      ],
    },
    {
      title: "People",
      rows: [
        ["Assigned technician", assignedLabel],
        ["Last client contact", job.lastClientContactAt ? formatUtcDateTime(job.lastClientContactAt) : "Not recorded"],
        ["Client decision", clientDecision],
      ],
    },
    {
      title: "Money",
      rows: [
        ["Client bill", formatBillAmount(clientBillValue)],
        ["Amount paid", formatBillAmount(totalClientPaid)],
        ["Balance due", formatBillAmount(clientBalanceDue)],
        ["Payment status", paymentStatus],
      ],
    },
    {
      title: "Repair Handling",
      rows: [
        ["Repair path", derivedRepairPath],
        ["Recommendation", recommendation],
        ["Attention", attentionItems.length ? `${attentionItems.length} item(s)` : "None"],
      ],
    },
  ];

  const canManageOneTimeExternal = role === "ADMIN" || role === "OPS" || role === "TECHNICIAN_INTERNAL";
  const oneTimeExternal = job.oneTimeExternalAssignment ?? null;
  const showOneTimeExternalPanel =
    canManageOneTimeExternal &&
    (
      showOneTimeForm ||
      Boolean(oneTimeExternal)
    );
  const oneTimeStatusOptions: Array<{ value: JobStatus; label: string }> = [
    { value: "REFERRED", label: "Referred" },
    { value: "COMPLETED", label: "Completed" },
  ];

  function dateInputValue(value: Date | null | undefined) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  return (
    // pb clears the fixed mobile action bar so no tab's last control (status
    // buttons, or the workflow Save on a completed job) hides beneath it.
    <div className="jobdetail-cal min-w-0 space-y-4 pb-44 lg:pb-0">
      {/* ── Canonical record action bar (desktop): Back · Repair Job # · status · actions ── */}
      <div className="hidden lg:block">
        <RecordActionBar
          backHref={returnTo}
          eyebrow="Service · Repair"
          title={`Repair Job ${job.jobNumber}`}
          status={{ label: prettyEnum(normalizeJobStatus(job.status)), tone: JOB_BAR_TONE[normalizeJobStatus(job.status)] }}
          secondary={
            <>
              <StatusShareButton jobNumber={job.jobNumber} />
              {role !== "TECHNICIAN_EXTERNAL" ? (
                <button type="button" onClick={() => router.push(`/jobs/${job.id}/edit`)} className="btn-premium-secondary rounded-lg px-3.5 py-2 text-[13px] font-semibold">
                  Edit
                </button>
              ) : null}
            </>
          }
        />
      </div>

      {/* ── DESKTOP next-step strip: the primary action + every valid alternative ── */}
      <div className="hidden overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] lg:block">
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex flex-1 items-center">
            {stageLabels.map((label, i) => (
              <div key={label} className={`flex items-center ${i < stageLabels.length - 1 ? "flex-1" : ""}`}>
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    i < currentStageIndex
                      ? "bg-emerald-500"
                      : i === currentStageIndex
                        ? "bg-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                        : "bg-[var(--panel-strong)] ring-1 ring-[var(--line)]"
                  }`} />
                  <span className={`whitespace-nowrap text-[12px] font-bold uppercase tracking-wide ${
                    i === currentStageIndex ? "text-[var(--accent)]" : "text-[var(--ink-muted)]"
                  }`}>{label}</span>
                </span>
                {i < stageLabels.length - 1 && (
                  <span className={`mx-2 h-px flex-1 ${i < currentStageIndex ? "bg-emerald-500" : "bg-[var(--line)]"}`} />
                )}
              </div>
            ))}
          </div>
          {!isTerminal && statusActions.length > 0 ? (
            <form
              action={(fd) => {
                fd.set("jobId", job.id);
                fd.set("nextStatus", statusActions[0]);
                fd.set("expectedUpdatedAt", expectedUpdatedAt);
                startStatusTransition(async () => {
                  const res = await updateJobAction(fd);
                  handleStatusUpdateResult(res, statusActions[0]);
                });
              }}
            >
              <button type="submit" disabled={isStatusPending} className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition active:scale-[0.98] disabled:opacity-60">
                {isStatusPending ? "Updating…" : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
                    {nextActionByStatus[statusKey]}
                  </>
                )}
              </button>
            </form>
          ) : isTerminal ? (
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
              <span className="text-[13px] font-semibold text-emerald-600">{prettyEnum(job.status)}</span>
            </div>
          ) : null}
        </div>
        {/* Every other valid transition stays one click away — nothing is hidden. */}
        {!isTerminal && statusActions.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--panel-strong)]/40 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Or move to</span>
            {statusActions.slice(1).map((status) =>
              status === "CLOSED" ? (
                <button
                  key={status}
                  type="button"
                  onClick={() => setConfirmClose(true)}
                  disabled={isStatusPending}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)] disabled:opacity-60"
                >
                  {prettyEnum(status)}
                </button>
              ) : (
                <form
                  key={status}
                  action={(fd) => {
                    fd.set("jobId", job.id);
                    fd.set("nextStatus", status);
                    fd.set("expectedUpdatedAt", expectedUpdatedAt);
                    startStatusTransition(async () => {
                      const res = await updateJobAction(fd);
                      handleStatusUpdateResult(res, status);
                    });
                  }}
                >
                  <button type="submit" disabled={isStatusPending} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)] disabled:opacity-60">
                    {prettyEnum(status)}
                  </button>
                </form>
              ),
            )}
          </div>
        ) : null}
      </div>

      {/* ── MOBILE HERO (compact) ── */}
      <div className={`${panelShellClass} lg:hidden`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <JobStatusBadge status={job.status} />
              <span className="mono text-[13px] text-[var(--ink-muted)]">{job.jobNumber}</span>
            </div>
            <h1 className="text-[22px] font-black leading-tight tracking-tight text-[var(--ink)]">
              {[job.brand, job.model].filter((v) => v && v !== "Unknown").join(" ") || job.deviceType}
            </h1>
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-[var(--ink-muted)]">{job.issueDescription}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[var(--ink-muted)]">
              {role !== "TECHNICIAN_EXTERNAL" && job.client?.fullName ? (
                <span>👤 <strong className="text-[var(--ink)]">{job.client.fullName}</strong></span>
              ) : null}
              <span>⚡ <strong className="text-[var(--ink)]">{
                assignedLabel === "No technician assigned yet." ? "Unassigned" : assignedLabel
              }</strong></span>
            </div>
          </div>
          {role !== "TECHNICIAN_EXTERNAL" ? (
            <button type="button" onClick={() => router.push(`/jobs/${job.id}/edit`)}
              className="shrink-0 rounded-lg bg-[var(--panel-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition active:opacity-70">
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {/* ── MOBILE PROGRESS + PRIMARY CTA ── */}
      <div className="lg:hidden space-y-3">
        {/* Slim progress dots with labels */}
        <div className="flex items-start px-1">
          {stageLabels.map((label, i) => (
            <div key={label} className={`flex items-start ${i < stageLabels.length - 1 ? "flex-1" : ""}`}>
              <div className="flex flex-col items-center" style={{ minWidth: 44 }}>
                <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-offset-[var(--bg)] ${
                  i < currentStageIndex
                    ? "bg-emerald-500 ring-emerald-500/40"
                    : i === currentStageIndex
                      ? "bg-[var(--accent)] ring-[var(--accent)]/40"
                      : "bg-[var(--panel-strong)] ring-[var(--line)]"
                }`} />
                <p className={`mt-1 text-center text-[13px] font-bold uppercase leading-none tracking-wider ${
                  i === currentStageIndex ? "text-[var(--accent)]" : "text-[var(--ink-muted)]"
                }`}>{label}</p>
              </div>
              {i < stageLabels.length - 1 && (
                <div className={`mt-[4px] h-px flex-1 mx-0.5 ${
                  i < currentStageIndex ? "bg-emerald-500" : "bg-[var(--line)]"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Primary workflow CTA */}
        {!isTerminal && statusActions.length > 0 ? (
          <form action={(fd) => {
            fd.set("jobId", job.id);
            fd.set("nextStatus", statusActions[0]);
            fd.set("expectedUpdatedAt", expectedUpdatedAt);
            startStatusTransition(async () => {
              const res = await updateJobAction(fd);
              handleStatusUpdateResult(res, statusActions[0]);
            });
          }}>
            <button
              type="submit"
              disabled={isStatusPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {isStatusPending ? (
                <span>Updating…</span>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
                  {nextActionByStatus[statusKey]}
                </>
              )}
            </button>
          </form>
        ) : isTerminal ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
            <p className="text-sm font-semibold text-emerald-600">{prettyEnum(job.status)}</p>
          </div>
        ) : null}

        {/* Time alert */}
        {watchLabel ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2">
            <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <p className="text-xs font-semibold text-amber-600">{watchLabel} · {statusAgeHours}h in this state</p>
          </div>
        ) : null}

        {/* Attention items */}
        {attentionItems.length > 0 ? (
          <div className="space-y-1.5">
            {attentionItems.map((item) => (
              <button key={item.label} type="button" onClick={() => setActive(item.tab)}
                className="flex w-full items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-left active:opacity-70">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--ink)]">{item.label}</p>
                  <p className="text-[12px] text-[var(--ink-muted)]">{item.action}</p>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {/* Key facts 2×2 grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">ETA</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--ink)]">{etaValue}</p>
          </div>
          <div className="rounded-xl bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Technician</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--ink)]">{
              assignedLabel === "No technician assigned yet." ? "Unassigned" : assignedLabel
            }</p>
          </div>
          {canViewFinancials ? (
            <>
              <div className="rounded-xl bg-[var(--panel-strong)] px-3 py-2.5">
                <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Total Bill</p>
                <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">
                  {clientBillValue > 0 ? `UGX ${formatBillAmount(clientBillValue)}` : "Not set"}
                </p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${
                clientBalanceDue > 0
                  ? "border-red-500/30 bg-red-500/8"
                  : clientBillValue > 0
                    ? "border-emerald-500/30 bg-emerald-500/8"
                    : "border-[var(--line)] bg-[var(--panel-strong)]"
              }`}>
                <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Balance</p>
                <p className={`mt-0.5 text-sm font-semibold ${
                  clientBalanceDue > 0 ? "text-red-500"
                  : clientBillValue > 0 ? "text-emerald-600"
                  : "text-[var(--ink)]"
                }`}>
                  {paymentStatus === "Paid" ? "Paid ✓"
                   : paymentStatus === "No bill set" ? "—"
                   : `UGX ${formatBillAmount(clientBalanceDue)}`}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Share button */}
        <div className="flex gap-2">
          <StatusShareButton jobNumber={job.jobNumber} />
        </div>
      </div>

      {/* ── Two-column console: context rail | work segments ── */}
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-3 lg:sticky lg:top-4">
        {/* Device */}
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--panel-strong)] text-xl">
              {job.photos?.[0]?.id ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/photos/${job.photos[0].id}`} alt="Device" className="h-full w-full object-cover" />
              ) : "📱"}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-[var(--ink)]">{[job.brand, job.model].filter((v) => v && v !== "Unknown").join(" ") || job.deviceType}</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-muted)] [overflow-wrap:anywhere]">{previewText(job.issueDescription, 90)}</p>
            </div>
          </div>
        </div>

        {/* Client & technician */}
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Client &amp; technician</p>
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
            <span className="text-[11.5px] text-[var(--ink-muted)]">Client</span>
            <span className="truncate text-[12.5px] font-semibold text-[var(--ink)]">{job.client?.fullName ?? "No client"}</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-[11.5px] text-[var(--ink-muted)]">Technician</span>
            <span className="truncate text-[12.5px] font-semibold text-[var(--ink)]">{assignedLabel === "No technician assigned yet." ? "Unassigned" : assignedLabel}</span>
          </div>
          {job.client?.phone ? (
            <div className="mt-3 flex gap-2">
              <a href={`tel:${job.client.phone}`} className="flex flex-1 items-center justify-center rounded-lg bg-[var(--panel-strong)] py-2 text-[11.5px] font-semibold text-[var(--ink)]">Call</a>
              <a href={`https://wa.me/${job.client.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center rounded-lg bg-emerald-500/12 py-2 text-[11.5px] font-semibold text-emerald-600">WhatsApp</a>
            </div>
          ) : null}
        </div>

        {/* Money */}
        {canViewFinancials ? (
          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Money</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-[11.5px] text-[var(--ink-muted)]">Client bill</span><span className="text-[12.5px] font-bold tabular-nums text-[var(--accent-fg)]">{formatBillAmount(clientBillValue)}</span></div>
              <div className="flex items-center justify-between"><span className="text-[11.5px] text-[var(--ink-muted)]">Paid</span><span className="text-[12.5px] font-bold tabular-nums text-emerald-600">{formatBillAmount(totalClientPaid)}</span></div>
              <div className="flex items-center justify-between"><span className="text-[11.5px] text-[var(--ink-muted)]">Balance due</span><span className={`text-[12.5px] font-bold tabular-nums ${clientBalanceDue > 0 ? "text-red-500" : "text-emerald-600"}`}>{formatBillAmount(clientBalanceDue)}</span></div>
            </div>
            <button type="button" onClick={() => setSegment("money")} className="mt-3 w-full rounded-lg bg-[var(--panel-strong)] py-2 text-[11.5px] font-semibold text-[var(--accent-fg)]">View money →</button>
          </div>
        ) : null}

        {/* Attention */}
        {attentionItems.length > 0 ? (
          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-600">Needs attention</p>
            <div className="space-y-2">
              {attentionItems.map((item) => (
                <button key={item.label} type="button" onClick={() => setActive(item.tab)} className="flex w-full items-start gap-2.5 rounded-lg bg-amber-500/8 px-3 py-2 text-left transition hover:bg-amber-500/12">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  <div><p className="text-[12px] font-semibold text-[var(--ink)]">{item.label}</p><p className="text-[11px] leading-snug text-[var(--ink-muted)]">{item.action}</p></div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Delivery — the handover record, shown once captured */}
        {hasDelivery ? (
          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Delivery</p>
            <div className="space-y-2">
              {deliveryMethodLabel ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-[var(--ink-muted)]">Method</span>
                  <span className="text-[12.5px] font-semibold text-[var(--ink)]">{deliveryMethodLabel}</span>
                </div>
              ) : null}
              {job.deliveredTo ? (
                <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2">
                  <span className="text-[11.5px] text-[var(--ink-muted)]">Received by</span>
                  <span className="truncate text-[12.5px] font-semibold text-[var(--ink)]">{job.deliveredTo}</span>
                </div>
              ) : null}
              {deliveryDate ? (
                <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2">
                  <span className="text-[11.5px] text-[var(--ink-muted)]">Date</span>
                  <span className="text-[12.5px] font-semibold text-[var(--ink)]">{deliveryDate}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
      <div className="min-w-0 space-y-3">

      {/* ── Segment nav — Work · Money · History ── */}
      <div className="sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto bg-[var(--bg)]/95 px-4 py-2 backdrop-blur-sm [scrollbar-width:none] lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0">
        {([
          { key: "work", label: "Work" },
          { key: "money", label: "Money" },
          ...(assessmentSlot ? [{ key: "assessment", label: "Assessment" } as const] : []),
          { key: "history", label: "History" },
        ] as const).map((s) => (
          <button
            type="button"
            key={s.key}
            onClick={() => setSegment(s.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              segment === s.key
                ? "bg-[var(--accent)] text-[#1c1600]"
                : "bg-[var(--panel)] text-[var(--ink-muted)] shadow-sm hover:text-[var(--ink)]"
            }`}
          >
            {s.label}
            {s.key === "history" && unreadCount > 0 ? (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Assessment report — folded in as its own tab instead of stacked below the page. */}
      {segment === "assessment" ? (
        <div className="space-y-3">{assessmentSlot}</div>
      ) : null}

      {/* Reassign the job to another client account — an admin action, surfaced as
          a top-of-page action (rendered once, all breakpoints) rather than buried
          in the History tab. */}
      {moveSlot ? <div className="flex justify-end">{moveSlot}</div> : null}

      {/* Client portal thread — grouped under History rather than floating at the
          bottom of the page. */}
      {segment === "history" && portalSlot ? (
        <div className="space-y-3">
          {portalSlot}
        </div>
      ) : null}

      {segment === "history" && role !== "TECHNICIAN_EXTERNAL" ? (
        <div className={`${panelShellClass} space-y-4`}>
          {/* Contact card */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-2xl font-black text-[var(--accent)]">
              {(job.client?.fullName ?? "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black text-[var(--ink)]">{job.client?.fullName ?? "No client"}</p>
              {job.client?.phone ? (
                <a href={`tel:${job.client.phone}`} className="text-sm text-[var(--accent)]">{job.client.phone}</a>
              ) : <p className="text-sm text-[var(--ink-muted)]">No phone</p>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {job.client?.phone ? (
              <a href={`tel:${job.client.phone}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--panel-strong)] py-2 text-xs font-semibold text-[var(--ink)] active:opacity-70">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.09 9.5a19.79 19.79 0 01-3-8.72A2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
                Call
              </a>
            ) : null}
            {job.client?.phone ? (
              <a href={`https://wa.me/${job.client.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-600 active:opacity-70">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            ) : null}
            {job.client?.email ? (
              <a href={`mailto:${job.client.email}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--panel-strong)] py-2 text-xs font-semibold text-[var(--ink)] active:opacity-70">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Email
              </a>
            ) : null}
          </div>

          {/* Details */}
          <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Contact details</p>
          <div className="divide-y divide-[var(--line)]">
            {job.client?.email ? (
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-xs text-[var(--ink-muted)]">Email</p>
                <p className="text-sm font-medium text-[var(--ink)] truncate max-w-[200px]">{job.client.email}</p>
              </div>
            ) : null}
            {job.client?.phone ? (
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-xs text-[var(--ink-muted)]">Phone</p>
                <p className="text-sm font-medium text-[var(--ink)]">{job.client.phone}</p>
              </div>
            ) : null}
            {job.client ? (
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-xs text-[var(--ink-muted)]">Profile</p>
                <a href={job.clientId ? `/clients/${job.clientId}` : `/clients`} className="text-sm font-medium text-[var(--accent)]">View client →</a>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {segment === "work" ? (
        <div className="space-y-4">
          <form
            action={(formData) => {
              formData.set("jobId", job.id);
              formData.set("expectedUpdatedAt", expectedUpdatedAt);
              startDiagnosisTransition(async () => {
                const res = await updateJobAction(formData);
                if (res.error) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Diagnosis updated");
                setSavedSection("diagnosis");
                router.refresh();
              });
            }}
            className={`${panelShellClass} space-y-3 [&_*]:min-w-0`}
          >
            {canAssignJobs ? (
              <div className={softSectionClass}>
                <p className="text-xs font-semibold text-[var(--ink-muted)]">Assign technician</p>
                {technicians.length === 0 ? (
                  <p className="text-[12px] text-[var(--ink-muted)]">
                    No technicians added yet. Use <span className="font-medium">One-Time External…</span> below for a one-off, or add internal/external technicians under{" "}
                    <Link href="/settings/users" className="text-[var(--accent)] underline">Settings → Users</Link> to pick from a list.
                  </p>
                ) : null}
                {showOneTimeForm || oneTimeExternal ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="min-w-0 sm:col-span-2">
                      <div className="flex items-center gap-2">
                        <label htmlFor="assignedToId" className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                          Assignment
                        </label>
                        {!oneTimeExternal && (
                          <button
                            type="button"
                            onClick={() => setShowOneTimeForm(false)}
                            className="text-[12px] text-[var(--accent)] underline"
                          >
                            ← Back to list
                          </button>
                        )}
                      </div>
                      <select
                        id="assignedToId"
                        name="assignedToId"
                        value="__one_time__"
                        className={fieldClass}
                        onChange={(e) => {
                          if (e.target.value === "__one_time__") {
                            setShowOneTimeForm(true);
                          } else {
                            setShowOneTimeForm(false);
                          }
                        }}
                      >
                        <option value="">Unassigned</option>
                        {technicians
                          .filter((technician) => !isSoftwareJob || technician.role !== "TECHNICIAN_EXTERNAL")
                          .map((technician) => (
                            <option key={technician.id} value={technician.id}>
                              {technician.name} ({technician.role === "TECHNICIAN_EXTERNAL" ? "External" : "Internal"})
                            </option>
                          ))}
                        <option value="__one_time__">One-Time External...</option>
                      </select>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Repair path</p>
                      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px] text-[var(--ink)]">
                        <span className="font-medium">{derivedRepairPath}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label htmlFor="assignedToId" className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                        Assigned Technician
                      </label>
                      <select
                        id="assignedToId"
                        name="assignedToId"
                        defaultValue={job.assignedTo?.id ?? ""}
                        className={fieldClass}
                        onChange={(e) => {
                          if (e.target.value === "__one_time__") {
                            setShowOneTimeForm(true);
                          }
                        }}
                      >
                        <option value="">Unassigned</option>
                        {technicians
                          .filter((technician) => !isSoftwareJob || technician.role !== "TECHNICIAN_EXTERNAL")
                          .map((technician) => (
                            <option key={technician.id} value={technician.id}>
                              {technician.name} ({technician.role === "TECHNICIAN_EXTERNAL" ? "External" : "Internal"})
                            </option>
                          ))}
                        <option value="__one_time__">One-Time External...</option>
                      </select>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Repair path</p>
                      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px] text-[var(--ink)]">
                        <span className="font-medium">{derivedRepairPath}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {role !== "TECHNICIAN_EXTERNAL" && diagnosisMode !== "external" ? (
              <textarea
                name="diagnosisNotes"
                defaultValue={job.diagnosisNotes ?? ""}
                placeholder="Internal diagnosis notes"
                className={areaClass}
              />
            ) : null}
            {diagnosisMode !== "internal" ? (
              <textarea
                name="externalDiagnosis"
                defaultValue={job.externalDiagnosis ?? ""}
                placeholder="External diagnosis"
                className={areaClass}
              />
            ) : null}
            {diagnosisMode === "internal" ? (
              <p className="text-xs text-[var(--ink-muted)]">External diagnosis is hidden for internal technician flow.</p>
            ) : null}
            <textarea
              name="partsNeeded"
              defaultValue={job.partsNeeded ?? ""}
              placeholder="Parts needed"
              readOnly={isTerminal}
              className={areaClass}
            />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                disabled={(isTerminal && !canAssignJobs) || !can.editDiagnosis(permissionUser) || isDiagnosisPending}
                className="btn-premium rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={isDiagnosisPending}
                className="btn-premium-secondary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              {savedSection === "diagnosis" ? <p className="text-xs text-[var(--accent)]">Saved</p> : null}
            </div>
          </form>

          {showOneTimeExternalPanel ? (
            <form
              action={(formData) => {
                formData.set("jobId", job.id);
                formData.set("expectedUpdatedAt", expectedUpdatedAt);
                startOneTimeExternalTransition(async () => {
                  const res = await updateOneTimeExternalAssignmentAction(formData);
                  if (res.error) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("One-time external technician saved");
                  setSavedSection("oneTimeExternal");
                  router.refresh();
                });
              }}
              className={`${panelShellClass} space-y-3 [&_*]:min-w-0`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--ink-muted)]">One-time external tech</p>
                <div className="shrink-0">
                  <select
                    name="outsourcingStatus"
                    defaultValue={oneTimeStatusOptions.some((o) => o.value === job.status) ? job.status : "PENDING_EXTERNAL_ASSIGNMENT"}
                    className={fieldClass}
                  >
                    {oneTimeStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Technician name *</label>
                  <input name="technicianName" required defaultValue={oneTimeExternal?.technicianName ?? ""} className={fieldClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Phone *</label>
                  <input name="phone" required defaultValue={oneTimeExternal?.phone ?? ""} className={fieldClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Agreed repair cost</label>
                  <input name="agreedRepairCost" inputMode="decimal" defaultValue={oneTimeExternal?.agreedRepairCost ?? ""} className={fieldClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Date assigned *</label>
                  <input type="date" name="assignedDate" required defaultValue={dateInputValue(oneTimeExternal?.assignedAt ?? new Date())} className={fieldClass} />
                </div>
              </div>

              {/* Tracking fields for later in the job — collapsed so assigning is
                  just name, phone, cost, date. Native <details> keeps them in the
                  DOM so they still submit when closed. */}
              <details className="rounded-lg border border-[var(--line)]">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-[var(--ink)]">
                  Parts, dates &amp; notes <span className="font-normal text-[var(--ink-muted)]">— optional</span>
                </summary>
                <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Specialization</label>
                    <input name="specialization" defaultValue={oneTimeExternal?.specialization ?? ""} className={fieldClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Expected return date</label>
                    <input type="date" name="expectedReturnDate" defaultValue={dateInputValue(oneTimeExternal?.expectedReturnAt)} className={fieldClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Returned / handover date</label>
                    <input type="date" name="returnedDate" defaultValue={dateInputValue(oneTimeExternal?.returnedAt)} className={fieldClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Progress notes</label>
                    <input name="progressNotes" defaultValue={oneTimeExternal?.progressNotes ?? ""} className={fieldClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Parts involved / expected parts cost</label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input name="partsNotes" placeholder="Parts notes" defaultValue={oneTimeExternal?.partsNotes ?? ""} className={fieldClass} />
                      <input
                        name="expectedPartsCost"
                        inputMode="decimal"
                        placeholder="Expected parts cost"
                        defaultValue={oneTimeExternal?.expectedPartsCost ?? ""}
                        className={fieldClass}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Notes / diagnosis / work instructions</label>
                    <textarea name="instructions" defaultValue={oneTimeExternal?.instructions ?? ""} className={areaClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Final outcome</label>
                    <textarea name="finalOutcome" defaultValue={oneTimeExternal?.finalOutcome ?? ""} className={areaClass} />
                  </div>
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isOneTimeExternalPending}
                  className="btn-premium w-full rounded-lg px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
                >
                  {oneTimeExternal ? "Update" : "Assign"}
                </button>
                {oneTimeExternal && (
                  <button
                    type="button"
                    onClick={() => setShowOneTimeForm(false)}
                    disabled={isOneTimeExternalPending}
                    className="btn-premium-secondary w-full rounded-lg px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
                  >
                    Cancel
                  </button>
                )}
                {savedSection === "oneTimeExternal" ? <p className="text-xs text-[var(--accent)]">Saved</p> : null}
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {segment === "work" ? (
        <form
          action={(formData) => {
            formData.set("jobId", job.id);
            formData.set("expectedUpdatedAt", expectedUpdatedAt);
            startRepairTransition(async () => {
              const res = await updateJobAction(formData);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Repair log updated");
              setSavedSection("repair");
              router.refresh();
            });
          }}
          className={`${panelShellClass} space-y-3 [&_*]:min-w-0`}
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-muted)]">Work done</label>
            <textarea name="workDone" readOnly={isTerminal} defaultValue={job.workDone ?? ""} placeholder="Describe the work carried out…" className={areaClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-muted)]">Parts replaced</label>
            <textarea name="partsReplaced" readOnly={isTerminal} defaultValue={job.partsReplaced ?? ""} placeholder="List parts replaced (if any)…" className={areaClass} />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button disabled={isTerminal || isRepairPending} className="btn-premium rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60">
              {isRepairPending ? "Saving…" : "Save Repair Log"}
            </button>
            <button type="button" onClick={() => setActive("overview")} disabled={isRepairPending}
              className="px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] transition active:opacity-60">
              Cancel
            </button>
            {savedSection === "repair" ? <p className="text-center text-xs text-[var(--accent)]">✓ Saved</p> : null}
          </div>
        </form>
      ) : null}

      {segment === "money" && canViewFinancials ? (
        <form
          action={(formData) => {
            formData.set("jobId", job.id);
            formData.set("expectedUpdatedAt", expectedUpdatedAt);
            startFinancialTransition(async () => {
              const res = await updateJobAction(formData);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Financials updated");
              setSavedSection("financials");
              router.refresh();
            });
          }}
          className={`${panelShellClass} space-y-4 [&_*]:min-w-0`}
        >
          {/* ── Money summary board — figures on hairline dividers ──────── */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--line)] sm:grid-cols-3">
            {([
              { label: "Client Bill",  value: formatBillAmount(clientBillValue),  tone: "text-[var(--accent-fg)]" },
              { label: "Amount Paid",  value: formatBillAmount(totalClientPaid),  tone: "text-emerald-600" },
              { label: "Balance Due",  value: formatBillAmount(clientBalanceDue), tone: clientBalanceDue > 0 ? "text-red-500" : "text-emerald-600" },
              { label: "Tech Cost",    value: formatBillAmount(technicianCost),   tone: "text-[var(--ink)]" },
              { label: "Tech Paid",    value: formatBillAmount(technicianPaid),   tone: "text-emerald-600" },
              { label: "Margin",       value: formatBillAmount(clientBillValue - technicianCost), tone: clientBillValue - technicianCost >= 0 ? "text-emerald-600" : "text-red-500" },
            ] as { label: string; value: string; tone: string }[]).map(({ label, value, tone }) => (
              <div key={label} className="bg-[var(--panel)] px-3 py-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-muted)]">{label}</p>
                <p className={`mt-1 truncate text-[17px] font-bold tabular-nums ${tone}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Cash position bar ─────────────────────────────────────── */}
          {clientBillValue > 0 ? (
            <div className="rounded-xl bg-[var(--panel-strong)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Payment progress</p>
                <span className={`rounded-full px-2 py-0.5 text-[13px] font-semibold ${paymentStatus === "Paid" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : paymentStatus === "Overpaid" ? "bg-blue-500/20 text-blue-700 dark:text-blue-400" : "bg-amber-400/20 text-amber-700"}`}>
                  {paymentStatus}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--panel)]">
                <div
                  className={`h-full rounded-full transition-all ${paymentStatus === "Paid" || paymentStatus === "Overpaid" ? "bg-emerald-500" : "bg-[var(--accent)]"}`}
                  style={{ width: `${Math.min(100, clientBillValue > 0 ? (totalClientPaid / clientBillValue) * 100 : 0)}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[13px] text-[var(--ink-muted)]">
                <span>Paid {formatBillAmount(totalClientPaid)}</span>
                <span>Total {formatBillAmount(clientBillValue)}</span>
              </div>
            </div>
          ) : null}

          {/* ── Section 1: Billing Details ────────────────────────────── */}
          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
            <div className="flex items-center gap-2 bg-[var(--panel-strong)] px-3 py-2.5">
              <p className="text-xs font-semibold text-[var(--ink)]">Billing</p>
            </div>
            <div className="space-y-3 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">{repairCostLabel}</label>
                  <input
                    name="externalTechBill"
                    type="number"
                    step="0.01"
                    defaultValue={job.externalTechBill ?? undefined}
                    placeholder="0.00"
                    className={fieldClass}
                  />
                </div>
                {canManageFinancials ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Client charge</label>
                    <input
                      name="clientBill"
                      type="number"
                      step="0.01"
                      value={billInput}
                      onChange={(e) => setBillInput(e.target.value)}
                      placeholder="0.00"
                      className={fieldClass}
                    />
                  </div>
                ) : null}
              </div>
              {canManageFinancials ? (
                <CheckboxField
                  name="vatApplicable"
                  checked={vatInput}
                  onChange={setVatInput}
                  withHiddenFalse
                  label="VAT applicable (18%)"
                  className="flex items-center gap-2 text-sm text-[var(--ink)]"
                />
              ) : null}
              {canManageFinancials ? (
                <LineItemTotals
                  variant="card"
                  currency="UGX"
                  formatMoney={formatBillAmount}
                  subtotal={liveBaseBeforeVat}
                  taxLabel="VAT (18%)"
                  taxAmount={liveVatAmount}
                  total={liveBill}
                />
              ) : null}
              {canManageFinancials && existingMargin !== null ? (
                <p className={`text-xs font-medium ${existingMargin >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  Margin: {existingMargin >= 0 ? "+" : ""}{formatBillAmount(existingMargin)}
                </p>
              ) : null}
              {clientBillValue > 0 && technicianCost > 0 && clientBillValue < technicianCost ? (
                <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600">Warning: amount charged to client is lower than technician cost.</p>
              ) : null}
              {!canManageFinancials ? (
                <p className="text-xs text-[var(--ink-muted)]">Client billing and payout controls are admin-only.</p>
              ) : null}
              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={isFinancialPending || (isTerminal && !canManageFinancials)}
                  className="btn-premium rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {isFinancialPending ? "Saving…" : "Save Billing"}
                </button>
                <button
                  type="button"
                  onClick={() => setActive("overview")}
                  disabled={isFinancialPending}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)]"
                >
                  Cancel
                </button>
                {savedSection === "financials" ? <p className="text-center text-xs text-[var(--accent)]">✓ Saved</p> : null}
              </div>
            </div>
          </div>

          {/* ── Section 2: Client Payments ────────────────────────────── */}
          {canManageFinancials && typeof job.clientBill === "number" && job.clientBill > 0 ? (
            <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
              <div className="flex items-center justify-between gap-2 bg-[var(--panel-strong)] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-[var(--ink)]">Payments</p>
                  <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${paymentStatus === "Paid" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : paymentStatus === "Overpaid" ? "bg-blue-500/20 text-blue-700 dark:text-blue-400" : "bg-amber-400/20 text-amber-700"}`}>
                    {paymentStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!showAddPaymentForm ? (
                    <button type="button" onClick={() => setShowAddPaymentForm(true)} className="btn-premium rounded-lg px-2.5 py-1 text-xs">
                      + Pay
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-3 p-4">
                {showAddPaymentForm ? (
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 space-y-3">
                    <p className="text-sm font-semibold text-[var(--ink)]">Record payment</p>
                    {/* Use div + manual FormData to avoid nested <form> inside the outer financials form */}
                    <div data-form-fields="client-payment" className="space-y-2" ref={(el) => { if (el) (el as HTMLElement & { _payFormEl?: HTMLElement })._payFormEl = el; }}>
                      <div className="grid gap-2 grid-cols-1 lg:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Amount</label>
                          <input name="amount" inputMode="decimal" placeholder="0.00" className={fieldClass} required />
                        </div>
                        <div>
                          <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Payment type</label>
                          <select name="kind" defaultValue="PAYMENT" className={fieldClass}>
                            <option value="PAYMENT">Payment</option>
                            <option value="DEPOSIT">Deposit</option>
                            <option value="PARTIAL">Partial payment</option>
                            <option value="BALANCE">Balance payment</option>
                            <option value="REFUND">Refund</option>
                            <option value="ADJUSTMENT">Adjustment</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Method</label>
                          <select name="method" defaultValue="CASH" className={fieldClass}>
                            <option value="CASH">Cash</option>
                            <option value="MOBILE_MONEY">Mobile money</option>
                            <option value="CARD">Card</option>
                            <option value="BANK_TRANSFER">Bank transfer</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {/* Currency locked to UGX — hidden field */}
                        <input type="hidden" name="currency" value="UGX" />
                        <input type="hidden" name="exchangeRateToBase" value="1" />
                        <div>
                          <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Reference / receipt #</label>
                          <input name="reference" placeholder="Optional" className={fieldClass} />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Notes</label>
                        <textarea name="note" placeholder="Optional notes" className={`${fieldClass} min-h-[60px]`} />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                        <input type="checkbox" name="confirmOverpayment" value="true" /> Confirm overpayment / refund / adjustment is intentional
                      </label>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={isFinancialPending}
                          className="btn-premium rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60"
                          onClick={(e) => {
                            const container = (e.currentTarget as HTMLElement).closest('[data-form-fields="client-payment"]');
                            if (!container) return;
                            const fd = new FormData();
                            fd.set("jobId", job.id);
                            container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea").forEach((el) => {
                              if (el.name) {
                                if (el instanceof HTMLInputElement && el.type === "checkbox") {
                                  if (el.checked) fd.set(el.name, el.value);
                                } else {
                                  fd.set(el.name, el.value);
                                }
                              }
                            });
                            startFinancialTransition(async () => {
                              const res = await recordClientPaymentAction(fd);
                              if (res.error) { toast.error(res.error); return; }
                              toast.success("Payment recorded");
                              setShowAddPaymentForm(false);
                              router.refresh();
                            });
                          }}
                        >Record Payment</button>
                        <button type="button" onClick={() => setShowAddPaymentForm(false)} disabled={isFinancialPending}
                          className="px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)]">Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {/* Mobile: payment cards */}
                <div className="space-y-2 lg:hidden">
                  {(() => {
                    if (clientPayments.length === 0) {
                      return <p className="py-4 text-center text-sm text-[var(--ink-muted)]">No payments recorded yet.</p>;
                    }
                    const billAmount = typeof job.clientBill === "number" ? job.clientBill : 0;
                    const sorted = [...clientPayments].sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
                    let runningPaid = 0;
                    return sorted.map((payment) => {
                      runningPaid += payment.kind === "REFUND" ? -payment.amount : payment.amount;
                      const balance = billAmount - runningPaid;
                      return (
                        <div key={payment.id} className="rounded-xl bg-[var(--panel-strong)] p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[var(--ink)]">{prettyEnum(payment.kind)} · {prettyEnum(payment.method)}</span>
                            <span className={`text-sm font-black tabular-nums ${payment.kind === "REFUND" ? "text-amber-600" : "text-emerald-600"}`}>
                              {payment.kind === "REFUND" ? "-" : "+"}UGX {formatBillAmount(payment.amount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[13px] text-[var(--ink-muted)]">
                            <span>{formatUtcDateTime(payment.receivedAt)}</span>
                            <span className={balance === 0 ? "text-emerald-600 font-semibold" : balance < 0 ? "text-blue-600 font-semibold" : "text-amber-600 font-semibold"}>
                              {balance === 0 ? "Fully paid ✓" : balance < 0 ? `${formatBillAmount(Math.abs(balance))} overpaid` : `${formatBillAmount(balance)} remaining`}
                            </span>
                          </div>
                          {(payment.reference || payment.note) ? (
                            <p className="text-[13px] text-[var(--ink-muted)]">{[payment.reference, payment.note].filter(Boolean).join(" · ")}</p>
                          ) : null}
                        </div>
                      );
                    });
                  })()}
                </div>
                {/* Desktop: payment table */}
                <div className="hidden lg:block">
                  {(() => {
                    const billAmount = typeof job.clientBill === "number" ? job.clientBill : 0;
                    const sorted = [...clientPayments].sort(
                      (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
                    );
                    let runningPaid = 0;
                    const paymentRows = sorted.map((payment) => {
                      runningPaid += payment.kind === "REFUND" ? -payment.amount : payment.amount;
                      return { ...payment, balance: billAmount - runningPaid };
                    });
                    return (
                      <DataTable
                        frameless
                        dense
                        className="overflow-hidden rounded-lg border border-[var(--line)]"
                        rows={paymentRows}
                        getRowKey={(payment) => payment.id}
                        empty="No payments recorded yet."
                        columns={[
                          { key: "date", header: "Date", cell: (payment) => formatUtcDateTime(payment.receivedAt) },
                          { key: "type", header: "Type", cell: (payment) => prettyEnum(payment.kind) },
                          { key: "method", header: "Method", cell: (payment) => prettyEnum(payment.method) },
                          {
                            key: "amount",
                            header: "Amount",
                            className: "font-semibold tabular-nums",
                            cell: (payment) => <>{payment.kind === "REFUND" ? "-" : ""}{formatBillAmount(payment.amount)}</>,
                          },
                          {
                            key: "balance",
                            header: "Balance",
                            className: "font-semibold tabular-nums",
                            cell: ({ balance }) => (
                              <span className={balance < 0 ? "text-blue-600 dark:text-blue-400" : balance === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}>
                                {balance < 0 ? `${formatBillAmount(Math.abs(balance))} over` : balance === 0 ? `${formatBillAmount(0)} ✓` : formatBillAmount(balance)}
                              </span>
                            ),
                          },
                          { key: "reference", header: "Reference", cell: (payment) => payment.reference ?? "-" },
                          { key: "notes", header: "Notes", cell: (payment) => payment.note ?? "-" },
                          { key: "recordedBy", header: "Recorded by", cell: (payment) => payment.createdBy?.name ?? "-" },
                        ]}
                      />
                    );
                  })()}
                </div>
                {/* end desktop table */}
              </div>
            </div>
          ) : null}

          {/* Show unpaid indicator even when not managing financials */}
          {!canManageFinancials && typeof job.clientBill === "number" && job.clientBill > 0 ? (
            <div className={softSectionClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Client Payment</p>
              <div className="flex items-center justify-between rounded-lg bg-[var(--panel-strong)] p-2">
                <p className="text-xs text-[var(--ink-muted)]">Amount: {formatBillAmount(clientBillValue)}</p>
                <span className={`rounded-full px-2 py-0.5 text-[13px] font-semibold ${job.clientPaid ? "bg-emerald-500 text-white" : "bg-amber-400/20 text-amber-700"}`}>
                  {job.clientPaid ? "Paid" : "Unpaid"}
                </span>
              </div>
            </div>
          ) : null}

          {/* ── Section 3: Technician Payouts ─────────────────────────── */}
          {hasPayoutControls ? (
            <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
              <div className="flex items-center justify-between gap-2 bg-[var(--panel-strong)] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-[var(--ink)]">Tech payout</p>
                  <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${technicianPayoutStatus === "Paid" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : technicianPayoutStatus === "Overpaid" ? "bg-amber-400/20 text-amber-700" : technicianCost <= 0 ? "bg-[var(--panel-strong)] text-[var(--ink-muted)]" : "bg-[var(--accent)]/10 text-[var(--accent)]"}`}>
                    {technicianPayoutStatus}
                  </span>
                </div>
                {!showPayoutForm ? (
                  <button type="button" onClick={() => setShowPayoutForm(true)} className="btn-premium-secondary rounded-lg px-2.5 py-1 text-xs">
                    + Payout
                  </button>
                ) : null}
              </div>
              <div className="space-y-3 p-3">
                <p className="text-xs text-[var(--ink-muted)]">
                  Cost: <strong className="text-[var(--ink)]">{formatBillAmount(technicianCost)}</strong>
                  {" · "}Paid: <strong className="text-emerald-600">{formatBillAmount(technicianPaid)}</strong>
                  {" · "}Balance: <strong className={technicianBalance > 0 ? "text-amber-600" : "text-emerald-600"}>{formatBillAmount(technicianBalance)}</strong>
                </p>
                {technicianCost > 0 && technicianPaid > technicianCost ? (
                  <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600">Warning: technician payout is higher than technician cost.</p>
                ) : null}
                {showPayoutForm ? (
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 space-y-3">
                    <p className="text-sm font-semibold text-[var(--ink)]">Record payout</p>
                    {/* Use div + manual FormData — avoids nested <form> inside the outer financials form */}
                    <div data-form-fields="tech-payout" className="space-y-2">
                      <div className="grid gap-2 grid-cols-1 lg:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]">Amount</label>
                          <input name="payout_amount" inputMode="decimal" placeholder="0.00" className={fieldClass} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]">Method</label>
                          <select name="payout_method" defaultValue="CASH" className={fieldClass}>
                            <option value="CASH">Cash</option>
                            <option value="MOBILE_MONEY">Mobile money</option>
                            <option value="CARD">Card</option>
                            <option value="BANK_TRANSFER">Bank transfer</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]">Reference</label>
                          <input name="payout_reference" placeholder="Optional" className={fieldClass} />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]">Notes</label>
                        <textarea name="payout_note" placeholder="Optional notes" className={`${fieldClass} min-h-[60px]`} />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                        <input type="checkbox" name="payout_confirmOverpayment" value="true" /> Confirm payout higher than technician cost
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isFinancialPending}
                          className="btn-premium rounded-lg px-4 py-2 text-sm disabled:opacity-60"
                          onClick={(e) => {
                            const container = (e.currentTarget as HTMLElement).closest('[data-form-fields="tech-payout"]');
                            if (!container) return;
                            const fd = new FormData();
                            fd.set("jobId", job.id);
                            const get = (n: string) => (container.querySelector(`[name="${n}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value ?? "";
                            const chk = (n: string) => (container.querySelector(`[name="${n}"]`) as HTMLInputElement | null)?.checked ?? false;
                            fd.set("amount", get("payout_amount"));
                            fd.set("method", get("payout_method"));
                            fd.set("reference", get("payout_reference"));
                            fd.set("note", get("payout_note"));
                            if (chk("payout_confirmOverpayment")) fd.set("confirmOverpayment", "true");
                            startFinancialTransition(async () => {
                              const res = await recordTechnicianPayoutAction(fd);
                              if (res.error) { toast.error(res.error); return; }
                              toast.success("Technician payout recorded");
                              setShowPayoutForm(false);
                              router.refresh();
                            });
                          }}
                        >Record Payout</button>
                        <button type="button" onClick={() => setShowPayoutForm(false)} disabled={isFinancialPending} className="btn-premium-secondary rounded-lg px-4 py-2 text-sm">Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : null}
                <DataTable
                  frameless
                  dense
                  className="overflow-hidden rounded-lg border border-[var(--line)]"
                  rows={technicianPayouts}
                  getRowKey={(payout) => payout.id}
                  empty="No technician payouts recorded yet."
                  columns={[
                    { key: "date", header: "Date", cell: (payout) => formatUtcDateTime(payout.paidAt) },
                    { key: "method", header: "Method", cell: (payout) => prettyEnum(payout.method) },
                    { key: "amount", header: "Amount", className: "font-semibold", cell: (payout) => formatBillAmount(payout.amount) },
                    { key: "reference", header: "Reference", cell: (payout) => payout.reference ?? "-" },
                    { key: "notes", header: "Notes", cell: (payout) => payout.note ?? "-" },
                    { key: "recordedBy", header: "Recorded by", cell: (payout) => payout.recordedBy?.name ?? "-" },
                  ]}
                />
              </div>
            </div>
          ) : null}
          {!hasPayoutControls && job.repairPath === "EXTERNAL" ? (
            <div className={softSectionClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Technician Payout</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">You can view financial summaries, but payout controls require finance authorization.</p>
            </div>
          ) : null}
          {job.repairPath !== "EXTERNAL" ? (
            <div className="rounded-xl border border-[var(--line)] px-3 py-2.5">
              <p className="text-xs font-semibold text-[var(--ink-muted)]">Tech payout — <span className="font-normal">only applies to external repairs</span></p>
            </div>
          ) : null}

          {/* ── Section 4: Financial Summary ──────────────────────────── */}
          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
            <div className="flex items-center gap-3 bg-[var(--panel-strong)] px-4 py-2.5">
              <p className="text-xs font-semibold text-[var(--ink)]">Financial summary</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {([
                { label: "Client bill",  value: formatBillAmount(clientBillValue),  tone: "text-[var(--ink)]" },
                { label: "Tech cost",    value: formatBillAmount(technicianCost),    tone: "text-[var(--ink)]" },
                { label: "Margin",       value: `${clientBillValue - technicianCost >= 0 ? "+" : ""}${formatBillAmount(clientBillValue - technicianCost)}`,
                                         tone: clientBillValue - technicianCost >= 0 ? "text-emerald-600" : "text-red-500" },
              ] as { label: string; value: string; tone: string }[]).map(({ label, value, tone }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <p className="text-xs text-[var(--ink-muted)]">{label}</p>
                  <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </form>
      ) : null}

      {segment === "money" && canViewJobDocuments ? (
        <div className={`${panelShellClass} space-y-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">Document lifecycle</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                All paperwork for this repair in order — from job card through invoice, receipt, and delivery.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {showJobCardAction ? (
                <a href={`/api/jobs/${job.id}/job-card`} target="_blank" rel="noreferrer" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                  Job Card PDF
                </a>
              ) : null}
              {showQuotationAction ? (
                <a href={`/api/jobs/${job.id}/quotation`} target="_blank" rel="noreferrer" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                  Quotation PDF
                </a>
              ) : null}
              {showInvoiceAction ? (
                <a href={`/api/jobs/${job.id}/invoice`} target="_blank" rel="noreferrer" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                  Invoice PDF
                </a>
              ) : null}
            </div>
          </div>
          {documentHints.length > 0 ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-800">
              {documentHints.join(" ")}
            </div>
          ) : null}
          <JobDocumentTimeline entries={documentTimeline} baseCurrency={orgBaseCurrency} />
        </div>
      ) : null}

      {segment === "work" && ["ADMIN", "OPS", "FRONT_DESK"].includes(role) ? (
        <div className={`${panelShellClass} space-y-4`}>
          {canUpdateClientCommunication ? (
            <form
              action={(formData) => {
                formData.set("jobId", job.id);
                formData.set("expectedUpdatedAt", expectedUpdatedAt);
                startCommunicationTransition(async () => {
                  const res = await updateJobAction(formData);
                  if (res.error) { toast.error(res.error); return; }
                  toast.success("Workflow updated");
                  setSavedSection("workflow");
                  router.refresh();
                });
              }}
              className={`space-y-3 ${softSectionClass} [&_*]:min-w-0`}
            >
              <p className="text-xs font-semibold text-[var(--ink-muted)]">Approval & workflow</p>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">Client decision</label>
                <select name="communicationStatus" defaultValue={job.communicationStatus ?? "NONE"} className={fieldClass}>
                  <option value="NONE">No update yet</option>
                  <option value="AWAITING_RESPONSE">Awaiting response</option>
                  <option value="APPROVED">Approved</option>
                  <option value="DECLINED">Declined</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">Recommendation</label>
                <select name="recommendationOption" defaultValue={job.recommendationOption ?? ""} className={fieldClass}>
                  <option value="">Not set</option>
                  <option value="PROCEED_REPAIR">Proceed with repair</option>
                  <option value="REPLACE_DEVICE">Replace device</option>
                  <option value="RETURN_UNREPAIRED">Return unrepaired</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                  Client communication note
                  {job.lastClientContactAt ? <span className="ml-2 text-[12px] text-[var(--accent)]">Last: {formatUtcDateTime(job.lastClientContactAt)}</span> : null}
                </label>
                <textarea
                  name="clientConversationNote"
                  defaultValue={job.clientConversationNote ?? ""}
                  placeholder="What did the client say?"
                  className={areaClass}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">Workflow reason</label>
                  <select name="workflowReason" defaultValue={job.workflowReason ?? "NONE"} className={fieldClass}>
                    <option value="NONE">No specific reason</option>
                    <option value="PARTS_PENDING">Parts pending</option>
                    <option value="SPECIALIST_ESCALATION">Specialist escalation</option>
                    <option value="CLIENT_DECLINED">Client declined</option>
                    <option value="UNREPAIRABLE">Unrepairable</option>
                    <option value="CUSTOMER_CANCELLED">Customer cancelled</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">ETA</label>
                  <input name="repairTimeline" defaultValue={job.repairTimeline ?? ""} placeholder="e.g. 2-3 days" className={fieldClass} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">Workflow note <span className="text-[var(--ink-muted)]/60">(optional)</span></label>
                <textarea
                  name="statusNote"
                  defaultValue={job.statusNote ?? ""}
                  placeholder="Internal note…"
                  className={areaClass}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={isCommunicationPending}
                  className="btn-premium rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60">
                  {isCommunicationPending ? "Saving…" : "Save Workflow"}
                </button>
                <button type="button" onClick={() => setActive("overview")} disabled={isCommunicationPending}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)]">
                  Cancel
                </button>
                {savedSection === "workflow" ? <p className="text-center text-xs text-[var(--accent)]">✓ Saved</p> : null}
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {segment === "history" && ["ADMIN", "OPS", "FRONT_DESK"].includes(role) ? (
        <div className={panelShellClass}>
          <p className="mb-3 text-xs font-semibold text-[var(--ink-muted)]">Activity log</p>
          <AuditTimeline items={job.auditLogs} />
        </div>
      ) : null}

      {segment === "history" ? (
        <div className={panelShellClass}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--ink)]">Photos</p>
            {job.photos.length > 0 ? (
              <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink-muted)]">{job.photos.length}</span>
            ) : null}
          </div>
          <PhotoUploader jobId={job.id} photos={job.photos} canDelete={role === "ADMIN"} canManageVisibility={role === "ADMIN" || role === "OPS"} />
        </div>
      ) : null}

      {segment === "history" && ["ADMIN", "OPS", "FRONT_DESK"].includes(role) ? (
        <MessagesTab
          jobId={job.id}
          clientPhone={job.client?.phone ?? null}
          clientEmail={job.client?.email ?? null}
          canSendQuote={canGenerateQuotation && !isIntake}
          canSendInvoice={canGenerateInvoice && invoiceEligibleByStatus && !isIntake}
          canSendJobCard={canGenerateJobCard && !isIntake}
          inbound={inboundMessages}
          outbound={outboundMessages}
        />
      ) : null}

      </div>
      </div>

      {statusActions.length > 0 && !isTerminal && !isIntake ? (
        <>
        <ConfirmDialog
          open={confirmClose}
          title="Close this job?"
          description="This will mark the job as non-repairable or client-declined. This action cannot be undone."
          confirmLabel="Close job"
          variant="danger"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            const formData = new FormData();
            formData.set("jobId", job.id);
            formData.set("expectedUpdatedAt", expectedUpdatedAt);
            formData.set("nextStatus", "CLOSED");
            formData.set("workflowReason", "UNREPAIRABLE");
            startStatusTransition(async () => {
              const res = await updateJobAction(formData);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Status updated");
              setSavedSection("status");
              router.refresh();
            });
          }}
        />
        <form
          action={(formData) => {
            formData.set("jobId", job.id);
            formData.set("expectedUpdatedAt", expectedUpdatedAt);
            startStatusTransition(async () => {
              const nextStatus = formData.get("nextStatus");
              const res = await updateJobAction(formData);
              handleStatusUpdateResult(
                res,
                typeof nextStatus === "string" ? (nextStatus as JobStatus) : undefined,
              );
            });
          }}
          className={`${panelShellClass} flex flex-wrap gap-2 [&_*]:min-w-0`}
        >
          {job.workflowReason && job.workflowReason !== "NONE" ? (
            <p className="w-full text-xs text-[var(--ink-muted)]">
              Current reason: {job.workflowReason.replaceAll("_", " ")}
              {job.statusNote ? ` | Note: ${job.statusNote}` : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 w-full">
            {statusActions.map((status) => (
              <button
                key={status}
                type={status === "CLOSED" ? "button" : "submit"}
                name={status === "CLOSED" ? undefined : "nextStatus"}
                value={status === "CLOSED" ? undefined : status}
                disabled={isStatusPending}
                onClick={status === "CLOSED" ? () => setConfirmClose(true) : undefined}
                className="btn-premium-dark rounded-lg px-3 py-1.5 text-[13px]"
              >
                Set {prettyEnum(status)}
              </button>
            ))}
          </div>
          {job.status === "READY_FOR_PICKUP" ? (
            <div className="w-full border-t border-[var(--line)] pt-3 mt-2">
              <p className="text-xs font-medium text-[var(--ink)] mb-2">Delivery (Optional)</p>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  name="deliveryMethod"
                  className="rounded-md border border-[var(--line)] px-2 py-1.5 text-sm bg-[var(--panel)]"
                >
                  <option value="">Method</option>
                  <option value="PICKUP">Client Pickup</option>
                  <option value="DELIVERY">We Delivered</option>
                  <option value="COURIER">Courier</option>
                </select>
                <input
                  type="text"
                  name="deliveredTo"
                  placeholder="Received by (name)"
                  className="rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm bg-[var(--panel)] flex-1 min-w-[120px]"
                />
              </div>
            </div>
          ) : null}
          {savedSection === "status" ? <p className="text-xs text-[var(--accent)]">Saved</p> : null}
        </form>
        </> ) : null}

      <div className="mobile-job-action-bar pointer-events-none fixed inset-x-0 bottom-[calc(var(--mobile-shell-bottom)+0.2rem)] z-30 px-3 lg:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/96 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.14)] backdrop-blur-md">
          {mobilePrimaryAction ? (
            mobilePrimaryAction.type === "link" ? (
              <a
                href={mobilePrimaryAction.href}
                target="_blank"
                rel="noreferrer"
                className="btn-premium flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-bold"
              >
                {mobilePrimaryAction.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setActive(mobilePrimaryAction.tab)}
                className="btn-premium flex-1 rounded-xl px-4 py-2.5 text-sm font-bold"
              >
                {mobilePrimaryAction.label}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setActive("overview")}
              className="btn-premium-secondary flex-1 rounded-xl px-4 py-2.5 text-sm"
            >
              Open Details
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMobileMoreOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/30 hover:text-[var(--ink)]"
              aria-label="More actions"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            {mobileMoreOpen ? (
              <>
              <div className="fixed inset-0 z-40" onClick={() => setMobileMoreOpen(false)} aria-hidden="true" />
              <div className="absolute bottom-14 right-0 z-50 w-52 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_8px_40px_rgba(0,0,0,0.18)]">
                {role !== "TECHNICIAN_EXTERNAL" ? (
                  <button type="button" onClick={() => { setMobileMoreOpen(false); router.push(`/jobs/${job.id}/edit`); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit Job
                  </button>
                ) : null}
                <div className="mx-3 my-1 border-t border-[var(--line)]" />
                <button type="button" onClick={() => { setMobileMoreOpen(false); setActive("diagnosis"); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Diagnosis
                </button>
                <button type="button" onClick={() => { setMobileMoreOpen(false); setActive("repair"); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  Repair Log
                </button>
                {canViewFinancials ? (
                  <button type="button" onClick={() => { setMobileMoreOpen(false); setActive("financials"); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Financials
                  </button>
                ) : null}
                {canViewJobDocuments ? (
                  <button type="button" onClick={() => { setMobileMoreOpen(false); setActive("documents"); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Documents
                  </button>
                ) : null}
                {showJobCardAction || showQuotationAction || showInvoiceAction ? (
                  <div className="mx-3 my-1 border-t border-[var(--line)]" />
                ) : null}
                {showJobCardAction ? (
                  <a href={`/api/jobs/${job.id}/job-card`} target="_blank" rel="noreferrer" className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Print Job Card
                  </a>
                ) : null}
                {showQuotationAction ? (
                  <a href={`/api/jobs/${job.id}/quotation`} target="_blank" rel="noreferrer" className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    Download Quote
                  </a>
                ) : null}
                {showInvoiceAction ? (
                  <a href={`/api/jobs/${job.id}/invoice`} target="_blank" rel="noreferrer" className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    Download Invoice
                  </a>
                ) : null}
              </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <JobCompletionFlowModal
        open={completionFlowOpen}
        onClose={() => setCompletionFlowOpen(false)}
        jobId={job.id}
        jobNumber={job.jobNumber}
        clientName={job.client?.fullName}
        clientPhone={job.client?.phone}
        clientBill={clientBillValue}
        balanceDue={clientBalanceDue}
        baseCurrency={orgBaseCurrency}
        initialInvoiceNumber={job.invoiceNumber}
        onOpenFinancials={() => setActive("financials")}
      />
    </div>
  );
}

// ── Status share button ───────────────────────────────────────────────────────

function StatusShareButton({ jobNumber, compact = false }: { jobNumber: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  function getUrl() {
    return `${window.location.origin}/status/${jobNumber}`;
  }

  function handleCopy() {
    const url = getUrl();
    // Use execCommand fallback directly — avoids Clipboard API permission
    // errors in iframes, WebViews, and non-HTTPS contexts.
    try {
      const el = document.createElement("textarea");
      el.value = url;
      el.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // execCommand not available — try Clipboard API
    }
    // Clipboard API (modern browsers outside restricted contexts)
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      ).catch(() => { /* permission denied — silently ignore */ });
    }
  }

  function handleWhatsApp() {
    const url = getUrl();
    const text = `Hi! Here's the live status link for your repair job ${jobNumber}: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title="Copy client status link"
        className="flex items-center gap-1 rounded-lg bg-[var(--panel-strong)] px-2 py-1 text-[13px] font-medium text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        )}
        {copied ? "Copied" : "Share"}
      </button>
    );
  }

  return (
    <details className="relative">
      <summary className="btn-premium-secondary inline-flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <span>Share Status</span>
      </summary>
      <div className="panel-shadow absolute left-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="p-3 space-y-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Client status link</p>
          <p className="break-all rounded bg-[var(--panel-strong)] px-2 py-1.5 mono text-[12px] text-[var(--ink-muted)]">
            /status/{jobNumber}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2 rounded-lg bg-[var(--panel-strong)] px-3 py-2 text-left text-[13px] font-medium text-[var(--ink)] transition hover:bg-[var(--accent)]/10"
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            )}
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex w-full items-center gap-2 rounded-lg bg-[var(--panel-strong)] px-3 py-2 text-left text-[13px] font-medium text-[var(--ink)] transition hover:bg-emerald-500/10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Send via WhatsApp
          </button>
        </div>
      </div>
    </details>
  );
}
