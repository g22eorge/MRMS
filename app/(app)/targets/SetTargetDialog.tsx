"use client";

import { useState, useTransition } from "react";
import { TargetEntityType, TargetMetric, TargetPeriod } from "@prisma/client";

import { Modal } from "@/components/ui/Modal";

import { setTarget } from "./actions";

type User = { id: string; name: string };
type Department = { id: string; name: string };
type Branch = { id: string; name: string };

type Props = {
  users: User[];
  departments: Department[];
  branches: Branch[];
};

const METRIC_LABELS: Record<TargetMetric, string> = {
  REVENUE: "Revenue",
  JOBS_COMPLETED: "Jobs Completed",
  LEADS_CONVERTED: "Leads Converted",
  QUOTATIONS_SENT: "Quotations Sent",
  POS_SALES: "POS Sales",
  SALES_COUNT: "Sales Count",
  CUSTOMER_SATISFACTION: "Customer Satisfaction",
  RESPONSE_TIME_HOURS: "Response Time (Hours)",
};

const PERIOD_LABELS: Record<TargetPeriod, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
  YEARLY: "Yearly",
};

function defaultPeriodLabel(period: TargetPeriod): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  if (period === "MONTHLY") return `${year}-${month}`;
  if (period === "QUARTERLY") return `${year}-Q${quarter}`;
  if (period === "ANNUAL") return `${year}`;
  if (period === "WEEKLY") {
    const startOfYear = new Date(year, 0, 1);
    const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, "0")}`;
  }
  return `${year}-${month}-${String(now.getDate()).padStart(2, "0")}`;
}

// Plain-English name for the current period, so a starter never types a coded
// label like "2026-Q2" — the machine label is still derived internally.
function friendlyPeriod(period: TargetPeriod): string {
  switch (period) {
    case "DAILY": return "today";
    case "WEEKLY": return "this week";
    case "MONTHLY": return "this month";
    case "QUARTERLY": return "this quarter";
    default: return "this year";
  }
}

export function SetTargetDialog({ users, departments, branches }: Props) {
  const [open, setOpen] = useState(false);
  const [entityType, setEntityType] = useState<TargetEntityType>("USER");
  const [entityId, setEntityId] = useState("");
  const [metric, setMetric] = useState<TargetMetric>("REVENUE");
  const [period, setPeriod] = useState<TargetPeriod>("MONTHLY");
  const [periodLabel, setPeriodLabel] = useState(() => defaultPeriodLabel("MONTHLY"));
  const [targetValue, setTargetValue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setEntityType("USER");
    setEntityId("");
    setMetric("REVENUE");
    setPeriod("MONTHLY");
    setPeriodLabel(defaultPeriodLabel("MONTHLY"));
    setTargetValue("");
    setNotes("");
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handlePeriodChange(p: TargetPeriod) {
    setPeriod(p);
    setPeriodLabel(defaultPeriodLabel(p));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const value = parseFloat(targetValue);
    if (!entityId) {
      setError("Please select an entity.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Target value must be a positive number.");
      return;
    }
    if (!periodLabel.trim()) {
      setError("Period label is required.");
      return;
    }

    startTransition(async () => {
      try {
        await setTarget({
          entityType,
          userId: entityType === "USER" ? entityId : undefined,
          departmentId: entityType === "DEPARTMENT" ? entityId : undefined,
          branchId: entityType === "BRANCH" ? entityId : undefined,
          metric,
          period,
          periodLabel: periodLabel.trim(),
          targetValue: value,
          notes: notes.trim() || undefined,
        });
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save target.");
      }
    });
  }

  const entityOptions =
    entityType === "USER"
      ? users
      : entityType === "DEPARTMENT"
        ? departments
        : branches;

  return (
    <>
      <button type="button" onClick={handleOpen} className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold">
        Set Target
      </button>

      <Modal open={open} onClose={handleClose} size="lg" ariaLabel="Set Target" backdropClassName="bg-black/40" panelClassName="p-6">
        <h2 className="text-base font-semibold text-[var(--ink)]">Set Target</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Define a performance target for a user, department, or branch.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--ink)]">Set target for</label>
                <select
                  value={entityType}
                  onChange={(e) => { setEntityType(e.target.value as TargetEntityType); setEntityId(""); }}
                  className="input mt-1 w-full"
                >
                  <option value="USER">User</option>
                  <option value="DEPARTMENT">Department</option>
                  <option value="BRANCH">Branch</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink)]">
                  {entityType === "USER" ? "User" : entityType === "DEPARTMENT" ? "Department" : "Branch"}
                </label>
                <select
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="input mt-1 w-full"
                  required
                >
                  <option value="">Select…</option>
                  {entityOptions.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink)]">Metric</label>
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as TargetMetric)}
                  className="input mt-1 w-full"
                >
                  {(Object.keys(METRIC_LABELS) as TargetMetric[]).map((m) => (
                    <option key={m} value={m}>{METRIC_LABELS[m]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink)]">How often</label>
                <select
                  value={period}
                  onChange={(e) => handlePeriodChange(e.target.value as TargetPeriod)}
                  className="input mt-1 w-full"
                >
                  {(Object.keys(PERIOD_LABELS) as TargetPeriod[]).map((p) => (
                    <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">Applies to {friendlyPeriod(period)} ({periodLabel})</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink)]">Target Value</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="input mt-1 w-full"
                  placeholder="e.g. 5000000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink)]">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="input mt-1 w-full resize-none"
                  placeholder="Any additional context…"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-premium-secondary rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {isPending ? "Saving…" : "Save Target"}
                </button>
              </div>
        </form>
      </Modal>
    </>
  );
}
