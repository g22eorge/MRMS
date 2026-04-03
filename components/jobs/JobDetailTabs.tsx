"use client";

import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateJobAction } from "@/app/(app)/jobs/[id]/actions";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { AuditTimeline } from "@/components/shared/AuditTimeline";
import { PhotoUploader } from "@/components/shared/PhotoUploader";
import { JobStatus } from "@/lib/job-status";
import { can } from "@/lib/permissions";

const tabs = ["overview", "client", "diagnosis", "repair", "financials", "timeline", "photos"] as const;

function formatUtcDateTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

type Props = {
  role: Role;
  technicians: Array<{
    id: string;
    name: string;
    role: Role;
  }>;
  job: {
    id: string;
    jobNumber: string;
    status: JobStatus;
    deviceType: string;
    brand: string;
    model: string;
    issueDescription: string;
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
  };
};

export function JobDetailTabs({ role, job, technicians }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<(typeof tabs)[number]>("overview");
  const [savedSection, setSavedSection] = useState<
    | "assignment"
    | "context"
    | "communication"
    | "diagnosis"
    | "repair"
    | "financials"
    | "status"
    | null
  >(null);
  const [isAssignPending, startAssignTransition] = useTransition();
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
  const canViewFinancials = role === "ADMIN" || role === "OPS";
  const canManageFinancials = role === "ADMIN";

  const visibleTabs = tabs.filter((tab) => {
    if (tab === "client") return role !== "TECHNICIAN_EXTERNAL";
    if (tab === "financials") return canViewFinancials;
    if (tab === "timeline") return ["ADMIN", "OPS"].includes(role);
    return true;
  });

  const allowedStatusTransitions: Partial<Record<JobStatus, JobStatus[]>> = {
    RECEIVED: ["DIAGNOSING"],
    DIAGNOSING: ["IN_REPAIR", "AWAITING_APPROVAL", "CLOSED"],
    AWAITING_APPROVAL: ["IN_REPAIR", "CLOSED"],
    IN_REPAIR: ["READY_FOR_PICKUP", "COMPLETED", "CLOSED"],
    READY_FOR_PICKUP: ["COMPLETED", "CLOSED"],
  };

  const statusActions = allowedStatusTransitions[job.status] ?? [];
  const isTerminal =
    job.status === "COMPLETED" || job.status === "CLOSED";
  const existingMargin =
    typeof job.clientBill === "number" && typeof job.externalTechBill === "number"
      ? job.clientBill - job.externalTechBill
      : null;
  const vatApplicable = job.vatApplicable ?? true;
  const clientBillValue = typeof job.clientBill === "number" ? job.clientBill : 0;
  const repairCostBeforeVat = vatApplicable ? clientBillValue / 1.18 : clientBillValue;
  const vatAmount = vatApplicable ? Math.max(clientBillValue - repairCostBeforeVat, 0) : 0;

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
          : job.status === "IN_REPAIR" || job.status === "READY_FOR_PICKUP"
            ? 3
            : 4;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{job.jobNumber}</h1>
            <p className="text-sm text-slate-600">
              {job.deviceType} / {job.brand} {job.model}
            </p>
          </div>
          <JobStatusBadge status={job.status} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActive(tab)}
            className={`rounded-md px-3 py-2.5 text-sm whitespace-nowrap ${
              active === tab ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === "overview" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Repair Journey</p>
            <div className="flex flex-nowrap gap-2 overflow-x-auto">
              {stageLabels.map((label, index) => {
                const isDone = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                return (
                  <span
                    key={label}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${
                      isCurrent
                        ? "border-teal-700 bg-teal-700 text-white"
                        : isDone
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {index + 1}. {label}
                  </span>
                );
              })}
              {job.status === "CLOSED" ? (
                <span className="whitespace-nowrap rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800">
                  Closed
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Step 1 - Intake</p>
            <p className="font-medium">Issue</p>
            <p className="text-sm text-slate-700">{job.issueDescription}</p>
          </div>

          <div className="mt-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Step 2 - Technician Diagnosis</p>
            <p className="text-sm text-slate-600">Assigned: {job.assignedTo?.name ?? "Unassigned"}</p>
            <p className="text-sm text-slate-600">Repair path: {derivedRepairPath}</p>
            {job.diagnosisNotes ? (
              <p className="text-sm text-slate-700">Internal diagnosis: {job.diagnosisNotes}</p>
            ) : null}
            {job.externalDiagnosis ? (
              <p className="text-sm text-slate-700">External diagnosis: {job.externalDiagnosis}</p>
            ) : null}
            {job.partsNeeded ? (
              <p className="text-sm text-slate-700">Parts needed: {job.partsNeeded}</p>
            ) : null}
          </div>

          {(role === "ADMIN" || role === "OPS") && technicians.length > 0 ? (
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
              className="mt-4 flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="min-w-[220px] flex-1">
                <label htmlFor="assignedToId" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                  Assigned Technician
                </label>
                <select
                  id="assignedToId"
                  name="assignedToId"
                  defaultValue={job.assignedTo?.id ?? ""}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.name} ({technician.role === "TECHNICIAN_EXTERNAL" ? "External" : "Internal"})
                    </option>
                  ))}
                </select>
              </div>
                <button
                  type="submit"
                  disabled={isAssignPending}
                className="btn-premium rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm"
                >
                  Save Assignment
                </button>
                {savedSection === "assignment" ? (
                  <p className="text-xs text-emerald-700">Saved</p>
                ) : null}
            </form>
          ) : null}

          {role === "ADMIN" || role === "OPS" ? (
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
              className="mt-4 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Step 3 - Client Approval & Recommendation
              </p>
              <select
                name="communicationStatus"
                defaultValue={job.communicationStatus ?? "NONE"}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="NONE">No update yet</option>
                <option value="AWAITING_RESPONSE">Awaiting response</option>
                <option value="APPROVED">Approved</option>
                <option value="DECLINED">Declined</option>
              </select>
              <p className="text-xs text-slate-600">
                Use Awaiting response after sharing estimate/details; set Approved or Declined when client confirms.
              </p>
              <select
                name="recommendationOption"
                defaultValue={job.recommendationOption ?? ""}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
                className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              {job.lastClientContactAt ? (
                <p className="text-xs text-slate-600">
                  Last client contact: {formatUtcDateTime(job.lastClientContactAt)}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={isCommunicationPending}
                className="btn-premium rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm"
              >
                Save Communication
              </button>
              {savedSection === "communication" ? (
                <p className="text-xs text-emerald-700">Saved</p>
              ) : null}
            </form>
          ) : null}

          <div className="mt-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Step 4 - Repair & Closure Context</p>
            {job.repairTimeline ? (
              <p className="text-sm text-slate-700">
                ETA: <span className="font-medium">{job.repairTimeline}</span>
                {job.timelineConfidence ? ` (${job.timelineConfidence.replaceAll("_", " ")})` : ""}
              </p>
            ) : (
              <p className="text-sm text-slate-600">ETA not set yet.</p>
            )}
            {job.timelineNote ? <p className="text-sm text-slate-600">ETA note: {job.timelineNote}</p> : null}
            {job.workflowReason && job.workflowReason !== "NONE" ? (
              <p className="text-sm text-slate-600">Workflow reason: {job.workflowReason.replaceAll("_", " ")}</p>
            ) : null}
            {job.statusNote ? <p className="text-sm text-slate-600">Workflow note: {job.statusNote}</p> : null}
          </div>

          {role === "ADMIN" || role === "OPS" ? (
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
              className="mt-4 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Update Repair / Closure Context</p>
              <select
                name="workflowReason"
                defaultValue={job.workflowReason ?? "NONE"}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
                className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={isContextPending}
                className="btn-premium rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm"
              >
                Save Context
              </button>
              {savedSection === "context" ? (
                <p className="text-xs text-emerald-700">Saved</p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {active === "client" && role !== "TECHNICIAN_EXTERNAL" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="font-medium">Client</p>
          <p className="text-sm">{job.client?.fullName}</p>
          <p className="text-sm text-slate-600">{job.client?.phone}</p>
          <p className="text-sm text-slate-600">{job.client?.email ?? "-"}</p>
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
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          {role !== "TECHNICIAN_EXTERNAL" && diagnosisMode !== "external" ? (
            <textarea
              name="diagnosisNotes"
              defaultValue={job.diagnosisNotes ?? ""}
              placeholder="Internal diagnosis notes"
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          ) : null}
          {diagnosisMode !== "internal" ? (
            <textarea
              name="externalDiagnosis"
              defaultValue={job.externalDiagnosis ?? ""}
              placeholder="External diagnosis"
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          ) : null}
          {diagnosisMode === "internal" ? (
            <p className="text-xs text-slate-600">
              External diagnosis is hidden for internal technician flow.
            </p>
          ) : null}
          <textarea
            name="partsNeeded"
            defaultValue={job.partsNeeded ?? ""}
            placeholder="Parts needed"
            readOnly={isTerminal}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
          />
          {role !== "TECHNICIAN_EXTERNAL" ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Repair path: <span className="font-medium">{derivedRepairPath}</span>
            </div>
          ) : null}
          <button disabled={isTerminal || !can.editDiagnosis(role) || isDiagnosisPending} className="btn-premium rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm">
            Save
          </button>
          {savedSection === "diagnosis" ? <p className="text-xs text-emerald-700">Saved</p> : null}
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
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <textarea name="workDone" readOnly={isTerminal} defaultValue={job.workDone ?? ""} placeholder="Work done" className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" />
          <textarea name="partsReplaced" readOnly={isTerminal} defaultValue={job.partsReplaced ?? ""} placeholder="Parts replaced" className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" />
          <button disabled={isTerminal || isRepairPending} className="btn-premium rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Save</button>
          {savedSection === "repair" ? <p className="text-xs text-emerald-700">Saved</p> : null}
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
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billing</p>
          <input
            name="externalTechBill"
            type="number"
            step="0.01"
            defaultValue={job.externalTechBill ?? undefined}
            placeholder={repairCostLabel}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          {!canManageFinancials ? (
            <p className="text-xs text-slate-600">
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
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          ) : null}
          {canManageFinancials ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
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
            <p className="text-xs text-slate-600">
              Repair cost: {repairCostBeforeVat.toFixed(2)} | VAT: {vatAmount.toFixed(2)} | Total: {clientBillValue.toFixed(2)}
            </p>
          ) : null}
          {canManageFinancials ? (
            <p className={`text-xs ${existingMargin !== null && existingMargin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              Repair margin: {existingMargin === null ? "Set external tech bill and client bill" : `${existingMargin >= 0 ? "+" : ""}${existingMargin.toFixed(2)}`}
            </p>
          ) : null}
          {canManageFinancials && job.repairPath === "EXTERNAL" ? (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">External Technician Payout</p>
              <input
                name="externalTechFee"
                type="number"
                step="0.01"
                defaultValue={job.externalTechFee ?? undefined}
                placeholder="Amount to pay technician"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                name="externalPaymentRef"
                defaultValue={job.externalPaymentRef ?? ""}
                placeholder="Payment reference (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
              <p className={`text-xs ${job.externalPaid ? "text-emerald-700" : "text-amber-700"}`}>
                {job.externalPaidAt
                  ? `Paid on ${formatUtcDateTime(job.externalPaidAt)}`
                  : "Not yet marked as paid"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="externalPaid"
                  value="true"
                  disabled={isFinancialPending}
                  className="btn-premium-success rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm"
                >
                  Mark Paid
                </button>
                <button
                  type="submit"
                  name="externalPaid"
                  value="false"
                  disabled={isFinancialPending}
                  className="btn-premium-warning rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm"
                >
                  Mark Unpaid
                </button>
              </div>
            </div>
          ) : null}
            <button
            disabled={isFinancialPending || (isTerminal && !canManageFinancials)}
            className="btn-premium rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm"
          >
            Save
          </button>
          {savedSection === "financials" ? <p className="text-xs text-emerald-700">Saved</p> : null}
        </form>
      ) : null}

      {active === "timeline" && ["ADMIN", "OPS"].includes(role) ? (
        <AuditTimeline items={job.auditLogs} />
      ) : null}

      {active === "photos" ? (
        <PhotoUploader jobId={job.id} photos={job.photos} canDelete={role === "ADMIN"} />
      ) : null}

      {isTerminal ? (
        <a
          href={`/api/jobs/${job.id}/invoice`}
          target="_blank"
          rel="noreferrer"
          className="btn-premium-secondary inline-block rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
        >
          Generate Invoice
        </a>
      ) : null}

      {statusActions.length > 0 && !isTerminal ? (
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
          className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4"
        >
          {job.workflowReason && job.workflowReason !== "NONE" ? (
            <p className="w-full text-xs text-slate-600">
              Current reason: {job.workflowReason.replaceAll("_", " ")}
              {job.statusNote ? ` | Note: ${job.statusNote}` : ""}
            </p>
          ) : null}
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
              className="btn-premium-dark rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
            >
              Set {status}
            </button>
          ))}
          {savedSection === "status" ? <p className="text-xs text-emerald-700">Saved</p> : null}
        </form>
      ) : null}
    </div>
  );
}
