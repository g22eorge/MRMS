type AuditItem = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: Date;
  user: { name: string };
};

type ActionMeta = {
  icon: string;
  chipClass: string;
  panelClass: string;
};

function getActionMeta(action: string): ActionMeta {
  if (action.includes("CREATED")) {
    return {
      icon: "+",
      chipClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
      panelClass: "border-emerald-200/70",
    };
  }
  if (action.includes("STATUS") || action.includes("UPDATE")) {
    return {
      icon: "~",
      chipClass: "bg-sky-100 text-sky-800 border-sky-200",
      panelClass: "border-sky-200/70",
    };
  }
  if (action.includes("PAY") || action.includes("BILL") || action.includes("INVOICE") || action.includes("COST")) {
    return {
      icon: "$",
      chipClass: "bg-amber-100 text-amber-800 border-amber-200",
      panelClass: "border-amber-200/70",
    };
  }
  if (action.includes("CLOSED") || action.includes("DECLINED")) {
    return {
      icon: "x",
      chipClass: "bg-rose-100 text-rose-800 border-rose-200",
      panelClass: "border-rose-200/70",
    };
  }
  return {
    icon: "i",
    chipClass: "bg-slate-100 text-slate-700 border-slate-200",
    panelClass: "border-slate-200",
  };
}

function formatActionLabel(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseDetail(detail: string | null): Record<string, unknown> | null {
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatDetailKey(key: string) {
  if (key === "jobNumber") return "Job #";
  if (key === "seeded") return "Seeded";
  if (key === "training") return "Training";
  if (key === "note") return "Note";
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatDetailValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function getTrainingSummary(action: string, detailObject: Record<string, unknown> | null) {
  if (!detailObject) return null;
  const isSeeded = detailObject.seeded === true;
  const isTraining = detailObject.training === true;
  if (!isSeeded && !isTraining) return null;

  const jobNumber = typeof detailObject.jobNumber === "string" ? detailObject.jobNumber : null;
  if (action === "JOB_CREATED" && jobNumber) {
    return `Training seed created ${jobNumber}.`;
  }
  if (typeof detailObject.note === "string" && detailObject.note.trim().length > 0) {
    return detailObject.note;
  }
  return "Training dataset activity recorded.";
}

export function AuditTimeline({ items }: { items: AuditItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const detailObject = parseDetail(item.detail);
        const trainingSummary = getTrainingSummary(item.action, detailObject);
        const detailEntries = detailObject ? Object.entries(detailObject) : [];
        const actionMeta = getActionMeta(item.action);

        return (
          <div key={item.id} className={`rounded-md border bg-white p-3 ${actionMeta.panelClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[11px] font-bold ${actionMeta.chipClass}`}>
                  {actionMeta.icon}
                </span>
                {formatActionLabel(item.action)}
              </p>
              <p className="text-xs text-slate-500">{item.createdAt.toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })}</p>
            </div>
            <p className="text-xs text-slate-500">by {item.user.name}</p>
            {trainingSummary ? (
              <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{trainingSummary}</p>
            ) : null}
            {detailEntries.length > 0 ? (
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {detailEntries.map(([key, value]) => (
                  <div key={key} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <dt className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{formatDetailKey(key)}</dt>
                    <dd className="mt-0.5 break-words text-xs font-medium text-slate-700">{formatDetailValue(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : item.detail ? (
              <pre className="mt-2 overflow-x-auto text-xs text-slate-700">{item.detail}</pre>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
