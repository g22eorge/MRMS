"use client";

import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateJobAction, updateOneTimeExternalAssignmentAction } from "@/app/(app)/jobs/[id]/actions";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { AuditTimeline } from "@/components/shared/AuditTimeline";
import { PhotoUploader } from "@/components/shared/PhotoUploader";
import { formatEATDateTime } from "@/lib/date-eat";
import { JobStatus, normalizeJobStatus } from "@/lib/job-status";
import { can } from "@/lib/permissions";

const tabs = ["overview", "client", "diagnosis", "repair", "financials", "timeline", "photos"] as const;

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

function statusWatchLabel(status: JobStatus, ageHours: number) {
  if (status === "AWAITING_APPROVAL" && ageHours >= 24) return "Client response delayed";
  if (status === "DIAGNOSING" && ageHours >= 12) return "Diagnosis aging";
  if (status === "RECEIVED" && ageHours >= 8) return "Needs triage";
  if (status === "IN_REPAIR" && ageHours >= 48) return "Repair duration high";
  if (status === "READY_FOR_PICKUP" && ageHours >= 24) return "Pickup follow-up due";
  return null;
}

const panelShellClass =
  "panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4";
const softSectionClass =
  "space-y-3 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/70 p-3";
const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";
const areaClass =
  "min-h-24 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";

type Props = {
  role: Role;
  permissions?: string[];
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
    auditLogs: Array<{
      id: string;
      action: string;
      detail: string | null;
      createdAt: Date;
      user: { name: string };
    }>;
    photos: Array<{ id: string; url: string; label: string | null }>;
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
};

export function JobDetailTabs({ role, permissions = [], job, technicians, deviceHistory = [] }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<(typeof tabs)[number]>("overview");
  const [savedSection, setSavedSection] = useState<
    | "assignment"
    | "oneTimeExternal"
    | "context"
    | "communication"
    | "diagnosis"
    | "repair"
    | "financials"
    | "status"
    | null
  >(null);
  const [isAssignPending, startAssignTransition] = useTransition();
  const [isOneTimeExternalPending, startOneTimeExternalTransition] = useTransition();
  const [isContextPending, startContextTransition] = useTransition();
  const [isCommunicationPending, startCommunicationTransition] = useTransition();
  const [isDiagnosisPending, startDiagnosisTransition] = useTransition();
  const [isRepairPending, startRepairTransition] = useTransition();
  const [isFinancialPending, startFinancialTransition] = useTransition();
  const [isStatusPending, startStatusTransition] = useTransition();

  useEffect(() => {
    if (!savedSection) return;
    const timer = setTimeout(() => setSavedSection(null), 2000);
    return () => clearTimeout(timer);
  }, [savedSection]);
  const permissionUser = { role, permissions };
  const canViewFinancials = can.viewFinancials(permissionUser);
  const canManageFinancials = can.approveInvoices(permissionUser);

  const isSoftwareJob = (job.serviceType ?? "HARDWARE") !== "HARDWARE";
  const canManagePayouts = role === "ADMIN" || can.reviewExternalBills(permissionUser);
  const canAssignJobs = can.assignJobs(permissionUser);
  const canUpdateClientCommunication = can.approveWork(permissionUser);
  const isIntake = role === "INTAKE";

  const visibleTabs = tabs.filter((tab) => {
    if (tab === "client") return role !== "TECHNICIAN_EXTERNAL";
    if (tab === "financials") return canViewFinancials;
    if (tab === "timeline") return ["ADMIN", "OPS", "INTAKE"].includes(role) || can.viewClientInfo(permissionUser);
    if ((tab === "diagnosis" || tab === "repair") && isIntake) return false;
    return true;
  });

  const allowedStatusTransitions: Partial<Record<ReturnType<typeof normalizeJobStatus>, JobStatus[]>> = {
    RECEIVED: ["DIAGNOSING"],
    DIAGNOSING: ["IN_EXTERNAL_REPAIR", "IN_REPAIR", "AWAITING_APPROVAL", "CLOSED"],
    IN_EXTERNAL_REPAIR: ["IN_REPAIR", "AWAITING_APPROVAL", "READY_FOR_PICKUP", "COMPLETED", "CLOSED"],
    AWAITING_APPROVAL: ["IN_REPAIR", "CLOSED"],
    IN_REPAIR: ["READY_FOR_PICKUP", "COMPLETED", "CLOSED"],
    READY_FOR_PICKUP: ["COMPLETED", "CLOSED"],
    COMPLETED: [],
    CLOSED: [],
  };

  const statusKey = normalizeJobStatus(job.status);
  const statusActions = allowedStatusTransitions[statusKey] ?? [];
  const isTerminal = job.status === "COMPLETED" || job.status === "CLOSED";
  const existingMargin =
    typeof job.clientBill === "number" && typeof job.externalTechBill === "number"
      ? job.clientBill - job.externalTechBill
      : null;
  const vatApplicable = job.vatApplicable ?? true;
  const clientBillValue = typeof job.clientBill === "number" ? job.clientBill : 0;
  const repairCostBeforeVat = vatApplicable ? clientBillValue / 1.18 : clientBillValue;
  const vatAmount = vatApplicable ? Math.max(clientBillValue - repairCostBeforeVat, 0) : 0;
  const hasPayoutControls = canManagePayouts && job.repairPath === "EXTERNAL";

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
      ? "EXTERNAL"
      : "IN_HOUSE";
  const repairCostLabel = diagnosisMode === "external" ? "External technician bill" : "Internal repair cost";
  const stageLabels = ["Intake", "Diagnosis", "Approval", "Repair", "Complete"] as const;
  const currentStageIndex =
    job.status === "RECEIVED"
      ? 0
      : job.status === "DIAGNOSING"
        ? 1
        : job.status === "AWAITING_APPROVAL"
          ? 2
          : (["IN_EXTERNAL_REPAIR", "IN_REPAIR", "READY_FOR_PICKUP"] as JobStatus[]).includes(job.status)
            ? 3
            : 4;
  const nextActionByStatus: Record<ReturnType<typeof normalizeJobStatus>, string> = {
    RECEIVED: "Start diagnosis",
    DIAGNOSING: "Capture diagnosis and set repair path",
    IN_EXTERNAL_REPAIR: "Capture progress updates and ETA",
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
  const narrativeBits = [
    `Status is ${prettyEnum(job.status)}.`,
    assignedLabel === "No technician assigned yet." ? assignedLabel : `Assigned to ${assignedLabel}.`,
    `Client decision: ${clientDecision.toLowerCase()}.`,
    job.repairTimeline ? `ETA ${etaValue}.` : "ETA not set.",
    watchLabel ? `${watchLabel} (${statusAgeHours}h in this state).` : null,
  ].filter(Boolean) as string[];

  const canManageOneTimeExternal = role === "ADMIN" || role === "OPS" || role === "TECHNICIAN_INTERNAL";
  const oneTimeExternal = job.oneTimeExternalAssignment ?? null;
  const showOneTimeExternalPanel =
    canManageOneTimeExternal &&
    (
      job.repairPath === "EXTERNAL" ||
      Boolean(oneTimeExternal) ||
      (["IN_EXTERNAL_REPAIR"] as JobStatus[]).includes(job.status)
    );
  const oneTimeStatusOptions: Array<{ value: JobStatus; label: string }> = [
    { value: "IN_EXTERNAL_REPAIR", label: "External Repair" },
    { value: "COMPLETED", label: "Completed" },
  ];

  function dateInputValue(value: Date | null | undefined) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  const rolePriorityBoost = (key: string) => {
    if (role === "INTAKE") {
      if (key === "clientDecision") return 4;
      if (key === "lastContact") return 3;
      if (key === "nextAction") return 2;
    }
    if (role === "TECHNICIAN_INTERNAL") {
      if (key === "assigned") return 4;
      if (key === "eta") return 3;
      if (key === "nextAction") return 2;
    }
    if (role === "ADMIN" || role === "OPS") {
      if (key === "watch") return 4;
      if (key === "nextAction") return 3;
      if (key === "status") return 2;
    }
    return 0;
  };

  const quickSignals = [
    {
      key: "status",
      label: "Current Status",
      value: prettyEnum(job.status),
      tone: "text-[#D4AF37]",
      accent: "bg-[#D4AF37]/10 border-[#D4AF37]/30",
      priority: 90,
    },
    {
      key: "watch",
      label: "Watch",
      value: watchLabel ? `${watchLabel} (${statusAgeHours}h)` : `Healthy (${statusAgeHours}h in state)`,
      tone: watchLabel ? "text-black" : "text-[#D4AF37]",
      accent: watchLabel ? "bg-[var(--panel-strong)] border-[var(--line)]" : "bg-[#D4AF37]/10 border-[#D4AF37]/30",
      priority: watchLabel ? 88 : 40,
    },
    {
      key: "assigned",
      label: "Assigned Tech",
      value: job.assignedTo?.name ?? job.oneTimeExternalAssignment?.technicianName ?? "Unassigned",
      tone: job.assignedTo?.name || job.oneTimeExternalAssignment?.technicianName ? "text-[var(--ink)]" : "text-black",
      accent: job.assignedTo?.name || job.oneTimeExternalAssignment?.technicianName
        ? "bg-[var(--panel)] border-[var(--line)]"
        : "bg-[var(--panel-strong)] border-[var(--line)]",
      priority: job.assignedTo?.name || job.oneTimeExternalAssignment?.technicianName ? 70 : 95,
    },
    {
      key: "clientDecision",
      label: "Client Decision",
      value: clientDecision,
      tone: "text-[var(--ink)]",
      accent: "bg-[var(--panel)] border-[var(--line)]",
      priority: job.communicationStatus === "AWAITING_RESPONSE" ? 86 : 58,
    },
    {
      key: "recommendation",
      label: "Recommendation",
      value: recommendation,
      tone: "text-[var(--ink)]",
      accent: "bg-[var(--panel)] border-[var(--line)]",
      priority: 50,
    },
    {
      key: "eta",
      label: "ETA",
      value: etaValue,
      tone: "text-[var(--ink)]",
      accent: "bg-[var(--panel)] border-[var(--line)]",
      priority: job.repairTimeline ? 64 : 74,
    },
    {
      key: "nextAction",
      label: "Next Action",
      value: nextActionByStatus[statusKey],
      tone: job.status === "COMPLETED" || job.status === "CLOSED" ? "text-[var(--ink)]" : "text-black",
      accent: job.status === "COMPLETED" || job.status === "CLOSED" ? "bg-[var(--panel)] border-[var(--line)]" : "bg-[var(--panel-strong)] border-[var(--line)]",
      priority: 84,
    },
    {
      key: "lastContact",
      label: "Last Client Contact",
      value: job.lastClientContactAt ? formatUtcDateTime(job.lastClientContactAt) : "Not recorded",
      tone: "text-[var(--ink)]",
      accent: "bg-[var(--panel)] border-[var(--line)]",
      priority: job.lastClientContactAt ? 52 : 80,
    },
    {
      key: "repairPath",
      label: "Repair Path",
      value: derivedRepairPath,
      tone: "text-[var(--ink)]",
      accent: "bg-[var(--panel)] border-[var(--line)]",
      priority: 54,
    },
    ...(canViewFinancials
      ? [
          {
            key: "clientBill",
            label: "Client Bill",
            value: typeof job.clientBill === "number" ? formatBillAmount(job.clientBill) : "Pending",
            tone: "text-[var(--ink)]",
            accent: "bg-[var(--panel)] border-[var(--line)]",
            priority: 56,
          },
        ]
      : []),
  ]
    .map((item) => ({ ...item, priority: item.priority + rolePriorityBoost(item.key) }))
    .sort((a, b) => b.priority - a.priority);

  return (
    <div className="min-w-0 space-y-4">
      <div className={panelShellClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{job.jobNumber}</h1>
            <p className="text-sm text-[var(--ink-muted)] [overflow-wrap:anywhere]">
              {job.deviceType} / {job.brand} {job.model}
            </p>
          </div>
          <JobStatusBadge status={job.status} />
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {visibleTabs.map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActive(tab)}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-sm capitalize transition ${
              active === tab
                ? "border-[#D4AF37] bg-[#D4AF37] text-white"
                : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)] hover:border-[#D4AF37]/50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === "overview" ? (
        <div className={panelShellClass}>
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Repair Journey</p>
            <div className="flex flex-wrap gap-2">
              {stageLabels.map((label, index) => {
                const isDone = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                return (
                  <span
                    key={label}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      isCurrent
                        ? "border-[#D4AF37] bg-[#D4AF37] text-white"
                        : isDone
                          ? "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]"
                          : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-muted)]"
                    }`}
                  >
                    {index + 1}. {label}
                  </span>
                );
              })}
              {job.status === "CLOSED" ? (
                <span className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1 text-xs font-medium text-black">
                  Closed
                </span>
              ) : null}
            </div>
          </div>

          <div className="mb-4 rounded-md border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#D4AF37]">Executive Brief</p>
            <p className="mt-1 text-sm text-[var(--ink)] [overflow-wrap:anywhere]">{narrativeBits.join(" ")}</p>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">At a Glance</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {quickSignals.map((signal) => (
                <div key={signal.label} className={`rounded-md border px-3 py-2 ${signal.accent}`}>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">{signal.label}</p>
                  <p className={`mt-1 text-sm font-medium ${signal.tone} [overflow-wrap:anywhere]`}>{signal.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={softSectionClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Step 1 - Intake</p>
            <p className="font-medium">Issue</p>
            <p className="text-sm text-[var(--ink)] [overflow-wrap:anywhere]">{job.issueDescription}</p>
          </div>

          {isSoftwareJob && role !== "TECHNICIAN_EXTERNAL" ? (
            <div className={`mt-4 ${softSectionClass}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Software Service</p>
              <p className="text-sm text-[var(--ink-muted)]">
                Type: <span className="font-medium text-[var(--ink)]">{prettyEnum(job.serviceType ?? "SOFTWARE")}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    job.softwareOsInstall ? "OS install" : null,
                    job.softwareDriversUpdates ? "Drivers + updates" : null,
                    job.softwareDataBackupRestore ? "Backup/restore" : null,
                    job.softwareAccountSetup ? "Account setup" : null,
                    job.softwarePerformanceTune ? "Performance tune" : null,
                    job.softwareThirdPartyApps ? "Third-party apps (client-licensed)" : null,
                  ] as const
                )
                  .filter(Boolean)
                  .map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-medium text-[var(--ink)]"
                    >
                      {label}
                    </span>
                  ))}
                {!job.softwareOsInstall &&
                !job.softwareDriversUpdates &&
                !job.softwareDataBackupRestore &&
                !job.softwareAccountSetup &&
                !job.softwarePerformanceTune &&
                !job.softwareThirdPartyApps ? (
                  <span className="text-xs text-[var(--ink-muted)]">No software scope selected.</span>
                ) : null}
              </div>

              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                License attestation: {job.softwareLicenseAttested ? "Confirmed" : "Not recorded"}
              </p>
              {job.softwareInstallerSource ? (
                <p className="text-sm text-[var(--ink-muted)]">
                  Installer source: {prettyEnum(job.softwareInstallerSource)}
                  {job.softwareInstallerSourceNote ? ` (${job.softwareInstallerSourceNote})` : ""}
                </p>
              ) : null}
              {job.softwareRequestedNotes ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink)] [overflow-wrap:anywhere]">
                  {job.softwareRequestedNotes}
                </p>
              ) : null}
            </div>
          ) : null}

          {deviceHistory.length > 0 ? (
            <div className={`mt-4 ${softSectionClass}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Device History</p>
              <p className="text-sm text-[var(--ink-muted)]">Past jobs linked to this device.</p>
              <div className="mt-2 grid gap-2">
                {deviceHistory.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => router.push(`/jobs/${h.id}`)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-left transition hover:border-[#D4AF37]/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)]">{h.jobNumber}</p>
                      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                        {prettyEnum(h.status)} · Received {formatUtcDateTime(h.receivedAt)}
                        {h.completedAt ? ` · Completed ${formatUtcDateTime(h.completedAt)}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                      Open
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className={`mt-4 ${softSectionClass}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Step 2 - Technician Diagnosis</p>
            <p className="text-sm text-[var(--ink-muted)] [overflow-wrap:anywhere]">
              Assigned: {job.assignedTo?.name ?? job.oneTimeExternalAssignment?.technicianName ?? "Unassigned"}
            </p>
            <p className="text-sm text-[var(--ink-muted)]">Repair path: {derivedRepairPath}</p>
            {job.diagnosisNotes ? (
              <p className="text-sm text-[var(--ink)] [overflow-wrap:anywhere]">Internal diagnosis: {job.diagnosisNotes}</p>
            ) : null}
            {job.externalDiagnosis ? (
              <p className="text-sm text-[var(--ink)] [overflow-wrap:anywhere]">External diagnosis: {job.externalDiagnosis}</p>
            ) : null}
            {job.partsNeeded ? (
              <p className="text-sm text-[var(--ink)] [overflow-wrap:anywhere]">Parts needed: {job.partsNeeded}</p>
            ) : null}
          </div>

          {canAssignJobs && technicians.length > 0 && !oneTimeExternal ? (
            <form
              action={(formData) => {
                formData.set("jobId", job.id);
                formData.set("expectedUpdatedAt", expectedUpdatedAt);
                startAssignTransition(async () => {
                  const res = await updateJobAction(formData);
                  if (res.error) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Assignment updated");
                  setSavedSection("assignment");
                  router.refresh();
                });
              }}
              className={`mt-4 flex flex-wrap items-end gap-2 ${softSectionClass} [&_*]:min-w-0`}
            >
              <div className="min-w-0 flex-1 sm:min-w-[220px]">
                <label htmlFor="assignedToId" className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                  Assigned Technician
                </label>
                <select
                  id="assignedToId"
                  name="assignedToId"
                  defaultValue={job.assignedTo?.id ?? ""}
                  className={fieldClass}
                >
                  <option value="">Unassigned</option>
                  {technicians
                    .filter((technician) => !isSoftwareJob || technician.role !== "TECHNICIAN_EXTERNAL")
                    .map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.name} ({technician.role === "TECHNICIAN_EXTERNAL" ? "External" : "Internal"})
                    </option>
                  ))}
                </select>
              </div>
                <button
                  type="submit"
                  disabled={isAssignPending}
                className="btn-premium w-full rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
                >
                  Save Assignment
                </button>
                {savedSection === "assignment" ? (
                  <p className="text-xs text-[#D4AF37]">Saved</p>
                ) : null}
            </form>
          ) : null}

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
              className={`mt-4 space-y-3 ${softSectionClass} [&_*]:min-w-0`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">One-Time External Technician</p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    Use this when outsourcing a specific job without creating a technician login. Updates are captured internally.
                  </p>
                </div>
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
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Technician name</label>
                  <input
                    name="technicianName"
                    required
                    defaultValue={oneTimeExternal?.technicianName ?? ""}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Phone</label>
                  <input
                    name="phone"
                    required
                    defaultValue={oneTimeExternal?.phone ?? ""}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Specialization</label>
                  <input
                    name="specialization"
                    defaultValue={oneTimeExternal?.specialization ?? ""}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Agreed repair cost</label>
                  <input
                    name="agreedRepairCost"
                    inputMode="decimal"
                    defaultValue={oneTimeExternal?.agreedRepairCost ?? ""}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Parts involved / expected parts cost</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      name="partsNotes"
                      placeholder="Parts notes"
                      defaultValue={oneTimeExternal?.partsNotes ?? ""}
                      className={fieldClass}
                    />
                    <input
                      name="expectedPartsCost"
                      inputMode="decimal"
                      placeholder="Expected parts cost"
                      defaultValue={oneTimeExternal?.expectedPartsCost ?? ""}
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Date assigned</label>
                  <input
                    type="date"
                    name="assignedDate"
                    required
                    defaultValue={dateInputValue(oneTimeExternal?.assignedAt ?? new Date())}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Expected return date</label>
                  <input
                    type="date"
                    name="expectedReturnDate"
                    defaultValue={dateInputValue(oneTimeExternal?.expectedReturnAt)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Returned / handover date</label>
                  <input
                    type="date"
                    name="returnedDate"
                    defaultValue={dateInputValue(oneTimeExternal?.returnedAt)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Progress notes</label>
                  <input
                    name="progressNotes"
                    defaultValue={oneTimeExternal?.progressNotes ?? ""}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Notes / diagnosis / work instructions</label>
                  <textarea
                    name="instructions"
                    defaultValue={oneTimeExternal?.instructions ?? ""}
                    className={areaClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Final outcome</label>
                  <textarea
                    name="finalOutcome"
                    defaultValue={oneTimeExternal?.finalOutcome ?? ""}
                    className={areaClass}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isOneTimeExternalPending}
                  className="btn-premium w-full rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
                >
                  {oneTimeExternal ? "Update External Assignment" : "Assign One-Time External Tech"}
                </button>
                {savedSection === "oneTimeExternal" ? (
                  <p className="text-xs text-[#D4AF37]">Saved</p>
                ) : null}
              </div>
            </form>
          ) : null}

          {canUpdateClientCommunication ? (
            <form
              action={(formData) => {
                formData.set("jobId", job.id);
                formData.set("expectedUpdatedAt", expectedUpdatedAt);
                startCommunicationTransition(async () => {
                  const res = await updateJobAction(formData);
                  if (res.error) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Client communication updated");
                  setSavedSection("communication");
                  router.refresh();
                });
              }}
               className={`mt-4 space-y-2 ${softSectionClass} [&_*]:min-w-0`}
             >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Step 3 - Client Approval & Recommendation
              </p>
              <select
                name="communicationStatus"
                defaultValue={job.communicationStatus ?? "NONE"}
                className={fieldClass}
              >
                <option value="NONE">No update yet</option>
                <option value="AWAITING_RESPONSE">Awaiting response</option>
                <option value="APPROVED">Approved</option>
                <option value="DECLINED">Declined</option>
              </select>
              <p className="text-xs text-[var(--ink-muted)]">
                Use Awaiting response after sharing estimate/details; set Approved or Declined when client confirms.
              </p>
              <select
                name="recommendationOption"
                defaultValue={job.recommendationOption ?? ""}
                className={fieldClass}
              >
                <option value="">Recommendation</option>
                <option value="PROCEED_REPAIR">Proceed with repair</option>
                <option value="REPLACE_DEVICE">Replace device</option>
                <option value="RETURN_UNREPAIRED">Return unrepaired</option>
              </select>
              <textarea
                name="clientConversationNote"
                defaultValue={job.clientConversationNote ?? ""}
                placeholder="Client communication note"
                className="min-h-20 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20"
              />
              {job.lastClientContactAt ? (
                <p className="text-xs text-[var(--ink-muted)]">
                  Last client contact: {formatUtcDateTime(job.lastClientContactAt)}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={isCommunicationPending}
                className="btn-premium w-full rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
              >
                Save Communication
              </button>
              {savedSection === "communication" ? (
                <p className="text-xs text-[#D4AF37]">Saved</p>
              ) : null}
            </form>
          ) : null}

           <div className={`mt-4 ${softSectionClass}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Step 4 - Repair & Closure Context</p>
            {job.repairTimeline ? (
              <p className="text-sm text-[var(--ink)]">
                ETA: <span className="font-medium">{job.repairTimeline}</span>
                {job.timelineConfidence ? ` (${job.timelineConfidence.replaceAll("_", " ")})` : ""}
              </p>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">ETA not set yet.</p>
            )}
            {job.timelineNote ? <p className="text-sm text-[var(--ink-muted)]">ETA note: {job.timelineNote}</p> : null}
            {job.workflowReason && job.workflowReason !== "NONE" ? (
              <p className="text-sm text-[var(--ink-muted)]">Workflow reason: {job.workflowReason.replaceAll("_", " ")}</p>
            ) : null}
            {job.statusNote ? <p className="text-sm text-[var(--ink-muted)]">Workflow note: {job.statusNote}</p> : null}
            {isIntake ? (
              <p className="text-sm text-[var(--ink)]">
                Client-facing cost: {typeof job.clientBill === "number" ? formatBillAmount(job.clientBill) : "Pending final approval"}
              </p>
            ) : null}
          </div>

          {canUpdateClientCommunication ? (
            <form
              action={(formData) => {
                formData.set("jobId", job.id);
                formData.set("expectedUpdatedAt", expectedUpdatedAt);
                startContextTransition(async () => {
                  const res = await updateJobAction(formData);
                  if (res.error) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Workflow context updated");
                  setSavedSection("context");
                  router.refresh();
                });
              }}
               className={`mt-4 space-y-2 ${softSectionClass} [&_*]:min-w-0`}
             >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Update Repair / Closure Context</p>
              <select
                name="workflowReason"
                defaultValue={job.workflowReason ?? "NONE"}
                className={fieldClass}
              >
                <option value="NONE">No specific reason</option>
                <option value="PARTS_PENDING">Parts pending</option>
                <option value="SPECIALIST_ESCALATION">Specialist escalation</option>
                <option value="CLIENT_DECLINED">Client declined</option>
                <option value="UNREPAIRABLE">Unrepairable</option>
                <option value="CUSTOMER_CANCELLED">Customer cancelled</option>
                <option value="OTHER">Other</option>
              </select>
              <textarea
                name="statusNote"
                defaultValue={job.statusNote ?? ""}
                placeholder="Context note (optional)"
                className="min-h-20 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20"
              />
              <button
                type="submit"
                disabled={isContextPending}
                className="btn-premium w-full rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
              >
                Save Context
              </button>
              {savedSection === "context" ? (
                <p className="text-xs text-[#D4AF37]">Saved</p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {active === "client" && role !== "TECHNICIAN_EXTERNAL" ? (
        <div className={panelShellClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Client Snapshot</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Name</p>
              <p className="mt-1 text-sm font-medium text-[var(--ink)]">{job.client?.fullName ?? "-"}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Phone</p>
              <p className="mt-1 text-sm font-medium text-[var(--ink)]">{job.client?.phone ?? "-"}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Email</p>
              <p className="mt-1 text-sm font-medium text-[var(--ink)]">{job.client?.email ?? "-"}</p>
            </div>
          </div>
        </div>
      ) : null}

      {active === "diagnosis" ? (
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
            <p className="text-xs text-[var(--ink-muted)]">
              External diagnosis is hidden for internal technician flow.
            </p>
          ) : null}
          <textarea
            name="partsNeeded"
            defaultValue={job.partsNeeded ?? ""}
            placeholder="Parts needed"
            readOnly={isTerminal}
            className={areaClass}
          />
          {role !== "TECHNICIAN_EXTERNAL" ? (
            <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)]">
              Repair path: <span className="font-medium">{derivedRepairPath}</span>
            </div>
          ) : null}
            <button disabled={isTerminal || !can.editDiagnosis(permissionUser) || isDiagnosisPending} className="btn-premium w-full rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm">
              Save
            </button>
          {savedSection === "diagnosis" ? <p className="text-xs text-[#D4AF37]">Saved</p> : null}
        </form>
      ) : null}

      {active === "repair" ? (
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
          <textarea name="workDone" readOnly={isTerminal} defaultValue={job.workDone ?? ""} placeholder="Work done" className={areaClass} />
          <textarea name="partsReplaced" readOnly={isTerminal} defaultValue={job.partsReplaced ?? ""} placeholder="Parts replaced" className={areaClass} />
          <button disabled={isTerminal || isRepairPending} className="btn-premium w-full rounded-md px-3 py-1.5 text-[13px] sm:w-auto sm:py-2 sm:text-sm">Save</button>
          {savedSection === "repair" ? <p className="text-xs text-[#D4AF37]">Saved</p> : null}
        </form>
      ) : null}

      {active === "financials" && canViewFinancials ? (
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
          className={`${panelShellClass} space-y-3 [&_*]:min-w-0`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Billing</p>
          <input
            name="externalTechBill"
            type="number"
            step="0.01"
            defaultValue={job.externalTechBill ?? undefined}
            placeholder={repairCostLabel}
            className={fieldClass}
          />
          {!canManageFinancials ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Client billing and payout controls are admin-only.
            </p>
          ) : null}
          {canManageFinancials ? (
            <input
              name="clientBill"
              type="number"
              step="0.01"
              defaultValue={job.clientBill ?? undefined}
              placeholder="Our bill to client"
              className={fieldClass}
            />
          ) : null}
          {canManageFinancials ? (
            <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
              <input
                type="checkbox"
                name="vatApplicable"
                value="true"
                defaultChecked={vatApplicable}
              />
              <input type="hidden" name="vatApplicable" value="false" />
              VAT applicable (18%)
            </label>
          ) : null}
          {canManageFinancials ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Repair cost: {formatBillAmount(repairCostBeforeVat)} | VAT: {formatBillAmount(vatAmount)} | Total: {formatBillAmount(clientBillValue)}
            </p>
          ) : null}
          {canManageFinancials ? (
              <p className={`text-xs [overflow-wrap:anywhere] ${existingMargin !== null && existingMargin >= 0 ? "text-[#D4AF37]" : "text-black"}`}>
                Repair margin: {existingMargin === null ? "Set external tech bill and client bill" : `${existingMargin >= 0 ? "+" : ""}${formatBillAmount(existingMargin)}`}
              </p>
          ) : null}
          {hasPayoutControls ? (
            <div className={softSectionClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">External Technician Payout</p>
              <div className="rounded-lg border border-[var(--line)] bg-white p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[var(--ink-muted)]">Payout status</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${job.externalPaid ? "bg-[#D4AF37] text-white" : "bg-[#D4AF37]/20 text-[#D4AF37]"}`}>
                    {job.externalPaid ? "Paid" : "Not paid"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  External bill: {typeof job.externalTechBill === "number" ? formatBillAmount(job.externalTechBill) : "-"}
                  {" | "}
                  Payout amount: {typeof job.externalTechFee === "number" ? formatBillAmount(job.externalTechFee) : "-"}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {job.externalPaidAt ? `Paid on ${formatUtcDateTime(job.externalPaidAt)}` : "Awaiting payout confirmation"}
                </p>
              </div>
              <input
                name="externalTechFee"
                type="number"
                step="0.01"
                defaultValue={job.externalTechFee ?? undefined}
                placeholder="Amount to pay technician"
                className={fieldClass}
              />
              <input
                name="externalPaymentRef"
                defaultValue={job.externalPaymentRef ?? ""}
                placeholder="Payment reference (optional)"
                className={fieldClass}
              />
              <p className={`text-xs ${job.externalPaid ? "text-[#D4AF37]" : "text-[#D4AF37]"}`}>
                {job.externalPaidAt
                  ? `Paid on ${formatUtcDateTime(job.externalPaidAt)}`
                  : "Not yet marked as paid"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isFinancialPending || (isTerminal && !canManageFinancials)}
                  className="btn-premium w-full rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
                >
                  Save Billing
                </button>
                <button
                  type="submit"
                  name="externalPaid"
                  value="true"
                  disabled={isFinancialPending || job.externalPaid === true}
                  className="btn-premium-success w-full rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
                >
                  Mark Paid
                </button>
                <button
                  type="submit"
                  name="externalPaid"
                  value="false"
                  disabled={isFinancialPending || job.externalPaid === false}
                  className="btn-premium-warning w-full rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
                >
                  Mark Unpaid
                </button>
              </div>
            </div>
          ) : null}
          {!hasPayoutControls && job.repairPath === "EXTERNAL" ? (
            <div className={softSectionClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">External Technician Payout</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                You can view financial summaries, but payout controls require finance authorization.
              </p>
            </div>
          ) : null}
          {job.repairPath !== "EXTERNAL" ? (
            <div className={softSectionClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">External Technician Payout</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Payout controls appear only when this job is set to external repair.
              </p>
            </div>
          ) : null}
          {!hasPayoutControls ? (
            <button
              disabled={isFinancialPending || (isTerminal && !canManageFinancials)}
              className="btn-premium w-full rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm"
            >
              Save Billing
            </button>
          ) : null}
          {savedSection === "financials" ? <p className="text-xs text-[#D4AF37]">Saved</p> : null}
        </form>
      ) : null}

      {active === "timeline" && ["ADMIN", "OPS", "INTAKE"].includes(role) ? (
        <div className={panelShellClass}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Timeline Activity</p>
          <AuditTimeline items={job.auditLogs} />
        </div>
      ) : null}

      {active === "photos" ? (
        <div className={panelShellClass}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Photo Evidence</p>
          <PhotoUploader jobId={job.id} photos={job.photos} canDelete={role === "ADMIN"} />
        </div>
      ) : null}

      {isTerminal ? (
        <a
          href={`/api/jobs/${job.id}/invoice`}
          target="_blank"
          rel="noreferrer"
          className="btn-premium-secondary inline-flex w-full items-center justify-center rounded-md px-3 py-1.5 text-[13px] sm:inline-block sm:w-auto sm:py-2 sm:text-sm"
        >
          Generate Invoice
        </a>
      ) : null}

      {statusActions.length > 0 && !isTerminal && !isIntake ? (
        <form
          action={(formData) => {
            formData.set("jobId", job.id);
            formData.set("expectedUpdatedAt", expectedUpdatedAt);
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
                type="submit"
                name="nextStatus"
                value={status}
                disabled={isStatusPending}
                onClick={(event) => {
                  if (
                    status === "CLOSED" &&
                    !window.confirm("Close this job? This will mark it as non-repairable/declined.")
                  ) {
                    event.preventDefault();
                  }
                }}
                className="btn-premium-dark rounded-md px-3 py-1.5 text-[13px]"
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
                  className="rounded-md border border-[var(--line)] px-2 py-1.5 text-sm bg-[var(--panel)] flex-1 min-w-[120px]"
                />
              </div>
            </div>
          ) : null}
          {savedSection === "status" ? <p className="text-xs text-[#D4AF37]">Saved</p> : null}
        </form>
      ) : null}
    </div>
  );
}
