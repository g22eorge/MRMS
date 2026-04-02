"use client";

import { JobStatus, Role } from "@prisma/client";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateJobAction } from "@/app/(app)/jobs/[id]/actions";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { AuditTimeline } from "@/components/shared/AuditTimeline";
import { PhotoUploader } from "@/components/shared/PhotoUploader";
import { can } from "@/lib/permissions";

const tabs = ["overview", "client", "diagnosis", "repair", "financials", "timeline", "photos"] as const;

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
    repairPath: "IN_HOUSE" | "EXTERNAL" | null;
    diagnosisNotes: string | null;
    externalDiagnosis: string | null;
    partsNeeded: string | null;
    workDone: string | null;
    partsReplaced: string | null;
    externalTechBill: number | null;
    clientBill: number | null;
    externalTechFee?: number | null;
    externalPaid?: boolean;
    externalPaidAt?: Date | null;
    externalPaymentRef?: string | null;
    repairTimeline: string | null;
    timelineMinMinutes?: number | null;
    timelineMaxMinutes?: number | null;
    timelineConfidence?: "FIRM" | "ESTIMATED" | "PARTS_DEPENDENT" | null;
    timelineNote?: string | null;
    assignedTo?: { id: string; name: string } | null;
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
  const [active, setActive] = useState<(typeof tabs)[number]>("overview");
  const [isPending, startTransition] = useTransition();
  const canManageFinancials = role === "ADMIN" || role === "ACCOUNTS";

  const visibleTabs = tabs.filter((tab) => {
    if (tab === "client") return role !== "TECHNICIAN_EXTERNAL";
    if (tab === "financials") return ["ADMIN", "ACCOUNTS", "OPS"].includes(role);
    if (tab === "timeline") return ["ADMIN", "OPS"].includes(role);
    return true;
  });

  const allowedStatusTransitions: Partial<Record<JobStatus, JobStatus[]>> = {
    RECEIVED: ["DIAGNOSING"],
    DIAGNOSING: ["IN_REPAIR", "REFERRED"],
    REFERRED: ["AWAITING_APPROVAL"],
    AWAITING_APPROVAL: ["IN_REPAIR", "CLOSED"],
    IN_REPAIR: ["COMPLETED"],
  };

  const statusActions = allowedStatusTransitions[job.status] ?? [];
  const isTerminal = job.status === "COMPLETED" || job.status === "CLOSED";
  const existingMargin =
    typeof job.clientBill === "number" && typeof job.externalTechBill === "number"
      ? job.clientBill - job.externalTechBill
      : null;

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
            className={`rounded-md px-3 py-2 text-sm ${
              active === tab ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === "overview" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="font-medium">Issue</p>
          <p className="text-sm text-slate-700">{job.issueDescription}</p>
          <p className="mt-2 text-sm text-slate-600">Assigned: {job.assignedTo?.name ?? "Unassigned"}</p>
          {job.repairTimeline ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p>
                ETA: <span className="font-medium">{job.repairTimeline}</span>
                {job.timelineConfidence ? ` (${job.timelineConfidence.replaceAll("_", " ")})` : ""}
              </p>
              {job.timelineNote ? <p className="mt-1 text-slate-600">Note: {job.timelineNote}</p> : null}
            </div>
          ) : null}

          {(role === "ADMIN" || role === "OPS") && technicians.length > 0 ? (
            <form
              action={(formData) => {
                formData.set("jobId", job.id);
                startTransition(async () => {
                  const res = await updateJobAction(formData);
                  if (res.error) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Assignment updated");
                  window.location.reload();
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
                disabled={isPending}
                className="rounded-md bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                Save Assignment
              </button>
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
            startTransition(async () => {
              const res = await updateJobAction(formData);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Diagnosis updated");
            });
          }}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          {role !== "TECHNICIAN_EXTERNAL" ? (
            <textarea
              name="diagnosisNotes"
              defaultValue={job.diagnosisNotes ?? ""}
              placeholder="Internal diagnosis notes"
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          ) : null}
          <textarea
            name="externalDiagnosis"
            defaultValue={job.externalDiagnosis ?? ""}
            placeholder="External diagnosis"
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <textarea
            name="partsNeeded"
            defaultValue={job.partsNeeded ?? ""}
            placeholder="Parts needed"
            readOnly={isTerminal}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
          />
          {role !== "TECHNICIAN_EXTERNAL" ? (
            <select
              name="repairPath"
              defaultValue={job.repairPath ?? ""}
              disabled={isTerminal}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Repair path</option>
              <option value="IN_HOUSE">In-house</option>
              <option value="EXTERNAL">External</option>
            </select>
          ) : null}
          <button disabled={isTerminal || !can.editDiagnosis(role) || isPending} className="rounded-md bg-teal-700 px-3 py-2 text-white disabled:opacity-60">
            Save
          </button>
        </form>
      ) : null}

      {active === "repair" ? (
        <form
          action={(formData) => {
            formData.set("jobId", job.id);
            startTransition(async () => {
              const res = await updateJobAction(formData);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Repair log updated");
            });
          }}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <textarea name="workDone" readOnly={isTerminal} defaultValue={job.workDone ?? ""} placeholder="Work done" className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" />
          <textarea name="partsReplaced" readOnly={isTerminal} defaultValue={job.partsReplaced ?? ""} placeholder="Parts replaced" className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" />
          <button disabled={isTerminal || isPending} className="rounded-md bg-teal-700 px-3 py-2 text-white">Save</button>
        </form>
      ) : null}

      {active === "financials" && ["ADMIN", "ACCOUNTS", "OPS"].includes(role) ? (
        <form
          action={(formData) => {
            formData.set("jobId", job.id);
            startTransition(async () => {
              const res = await updateJobAction(formData);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Financials updated");
              window.location.reload();
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
            placeholder="External tech bill"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
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
                  ? `Paid on ${new Date(job.externalPaidAt).toLocaleString()}`
                  : "Not yet marked as paid"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="externalPaid"
                  value="true"
                  disabled={isPending}
                  className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  Mark Paid
                </button>
                <button
                  type="submit"
                  name="externalPaid"
                  value="false"
                  disabled={isPending}
                  className="rounded-md bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  Mark Unpaid
                </button>
              </div>
            </div>
          ) : null}
          <button
            disabled={isPending || (isTerminal && !canManageFinancials)}
            className="rounded-md bg-teal-700 px-3 py-2 text-white disabled:opacity-60"
          >
            Save
          </button>
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
          className="inline-block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          Generate Invoice
        </a>
      ) : null}

      {statusActions.length > 0 && !isTerminal ? (
        <form
          action={(formData) => {
            formData.set("jobId", job.id);
            startTransition(async () => {
              const res = await updateJobAction(formData);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Status updated");
              window.location.reload();
            });
          }}
          className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4"
        >
          {statusActions.map((status) => (
            <button
              key={status}
              type="submit"
              name="nextStatus"
              value={status}
              onClick={(event) => {
                if (status === "CLOSED" && !window.confirm("Close this job? This will mark it as declined/unrepairable.")) {
                  event.preventDefault();
                }
              }}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white"
            >
              Set {status}
            </button>
          ))}
        </form>
      ) : null}
    </div>
  );
}
