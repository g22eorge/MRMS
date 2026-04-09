"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RepairRequest, RepairRequestStatus } from "@prisma/client";

/* ── helpers ── */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING_INTAKE: { label: "Pending Intake", cls: "bg-amber-100 text-amber-800" },
  APPROVED:       { label: "Approved",        cls: "bg-emerald-100 text-emerald-800" },
  REJECTED:       { label: "Rejected",        cls: "bg-rose-100 text-rose-800" },
  CONVERTED_TO_JOB: { label: "Converted to Job", cls: "bg-blue-100 text-blue-800" },
};

const HANDOVER_LABEL: Record<string, string> = {
  SELF_DROPOFF:             "Self Drop-off",
  SEND_WITH_DELIVERY_PERSON: "Delivery Person",
  REQUEST_PICKUP:           "Pickup Requested",
};

const DEVICE_LABEL: Record<string, string> = {
  PHONE_ANDROID: "Android Phone",
  PHONE_IPHONE:  "iPhone",
  TABLET:        "Tablet",
  WINDOWS_PC:    "Windows PC / Laptop",
  MAC:           "Mac",
  OTHER:         "Other",
};

function fmt(d: Date | string) {
  return new Date(d).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}

/* ── status badge ── */
function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

/* ── detail row ── */
function DRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm py-1.5 border-b border-slate-100 last:border-0">
      <span className="w-40 shrink-0 text-slate-500 font-medium">{label}</span>
      <span className="text-slate-800 break-words min-w-0">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2">{title}</p>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-1">{children}</div>
    </div>
  );
}

/* ── action button ── */
function ActionBtn({
  label, icon, className, onClick, disabled,
}: {
  label: string; icon: React.ReactNode; className: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {icon}{label}
    </button>
  );
}

/* ── drawer ── */
function RequestDrawer({
  req, onClose, onStatusChange,
}: {
  req: RepairRequest;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(req.requestStatus);
  const router = useRouter();

  function act(status: string) {
    startTransition(async () => {
      const res = await fetch(`/api/repair-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.jobId) {
          router.push(`/jobs/${data.jobId}`);
          return;
        }
        setLocalStatus(status as RepairRequestStatus);
        onStatusChange(req.id, status);
      }
    });
  }

  const isPending   = localStatus === "PENDING_INTAKE";
  const isApproved  = localStatus === "APPROVED";
  const isConverted = localStatus === "CONVERTED_TO_JOB";
  const isRejected  = localStatus === "REJECTED";

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Repair Request</p>
            <h2 className="text-lg font-bold text-slate-800">{req.requestNumber}</h2>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={localStatus} />
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* converted — open job banner */}
        {isConverted && req.linkedJobId && (
          <div className="px-6 py-3 border-b border-blue-100 bg-blue-50 flex items-center justify-between gap-3">
            <p className="text-xs text-blue-700 font-medium">This request was converted to a job.</p>
            <a
              href={`/jobs/${req.linkedJobId}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open Job
            </a>
          </div>
        )}

        {/* actions bar */}
        {!isConverted && !isRejected && (
          <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center gap-2 flex-wrap">
            {isPending && (
              <>
                <ActionBtn
                  label="Approve"
                  disabled={pending}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => act("APPROVED")}
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                />
                <ActionBtn
                  label="Reject"
                  disabled={pending}
                  className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                  onClick={() => act("REJECTED")}
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>}
                />
              </>
            )}
            {isApproved && (
              <ActionBtn
                label="Convert to Job"
                disabled={pending}
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => act("CONVERTED_TO_JOB")}
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
              />
            )}
            {pending && (
              <span className="text-xs text-slate-400 ml-1">Saving…</span>
            )}
          </div>
        )}

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          <Section title="Customer">
            <DRow label="Name"              value={req.customerName} />
            <DRow label="Phone"             value={req.phone} />
            <DRow label="Email"             value={req.email} />
            <DRow label="Preferred Contact" value={req.preferredContactMethod} />
          </Section>

          <Section title="Device">
            <DRow label="Type"          value={DEVICE_LABEL[req.deviceType] ?? req.deviceType} />
            <DRow label="Brand"         value={req.brand} />
            <DRow label="Model"         value={req.model || "—"} />
            <DRow label="Serial Number" value={req.serialNumber} />
          </Section>

          <Section title="Issue">
            <div className="py-2 text-sm text-slate-800 whitespace-pre-wrap">{req.problemDescription}</div>
          </Section>

          <Section title="Handover">
            <DRow label="Method" value={HANDOVER_LABEL[req.handoverMethod] ?? req.handoverMethod} />

            {req.handoverMethod === "SELF_DROPOFF" && (
              <>
                <DRow label="Preferred Date" value={req.preferredDropoffDate} />
                <DRow label="Preferred Time" value={req.preferredDropoffTime} />
                <DRow label="Notes"          value={req.dropoffNotes} />
              </>
            )}

            {req.handoverMethod === "SEND_WITH_DELIVERY_PERSON" && (
              <>
                <DRow label="Delivery Person"  value={req.deliveryPersonName} />
                <DRow label="Delivery Phone"   value={req.deliveryPersonPhone} />
                <DRow label="Courier Company"  value={req.deliveryCompany} />
                <DRow label="Dispatch Date"    value={req.dispatchDate} />
                <DRow label="Expected Arrival" value={req.expectedArrivalTime} />
                <DRow label="Tracking Ref"     value={req.deliveryTrackingReference} />
                <DRow label="Fee Responsibility" value={req.deliveryFeeResponsibility} />
                <DRow label="Notes"            value={req.deliveryNotes} />
              </>
            )}

            {req.handoverMethod === "REQUEST_PICKUP" && (
              <>
                <DRow label="Address"          value={req.pickupAddress} />
                <DRow label="Landmark"         value={req.pickupLandmark} />
                <DRow label="Preferred Date"   value={req.preferredPickupDate} />
                <DRow label="Preferred Time"   value={req.preferredPickupTime} />
                <DRow label="Alt. Contact"     value={req.alternateContactPerson} />
                <DRow label="Alt. Phone"       value={req.alternateContactPhone} />
                <DRow label="Pickup Notes"     value={req.pickupNotes} />
              </>
            )}
          </Section>

          <Section title="Meta">
            <DRow label="Submitted"  value={fmt(req.createdAt)} />
            <DRow label="Request #"  value={req.requestNumber} />
          </Section>
        </div>
      </div>
    </>
  );
}

/* ── inline row actions ── */
function RowActions({
  req,
  onStatusChange,
  onView,
}: {
  req: RepairRequest;
  onStatusChange: (id: string, status: string) => void;
  onView: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function act(status: string, e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const res = await fetch(`/api/repair-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.jobId) {
          router.push(`/jobs/${data.jobId}`);
          return;
        }
        onStatusChange(req.id, status);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {req.requestStatus === "PENDING_INTAKE" && (
        <>
          <button
            disabled={pending}
            onClick={(e) => act("APPROVED", e)}
            title="Approve"
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Approve
          </button>
          <button
            disabled={pending}
            onClick={(e) => act("REJECTED", e)}
            title="Reject"
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-40 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            Reject
          </button>
        </>
      )}
      {req.requestStatus === "APPROVED" && (
        <button
          disabled={pending}
          onClick={(e) => act("CONVERTED_TO_JOB", e)}
          title="Convert to Job"
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-40 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          Convert to Job
        </button>
      )}
      {req.requestStatus === "CONVERTED_TO_JOB" && req.linkedJobId && (
        <a
          href={`/jobs/${req.linkedJobId}`}
          onClick={(e) => e.stopPropagation()}
          title="Open Job"
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open Job
        </a>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onView(); }}
        title="View details"
        className="inline-flex items-center rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
  );
}

/* ── main table ── */
export function IntakeClient({ initialRequests }: { initialRequests: RepairRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [selected, setSelected] = useState<RepairRequest | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  function handleStatusChange(id: string, status: string) {
    const s = status as RepairRequestStatus;
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, requestStatus: s } : r))
    );
    if (selected?.id === id) {
      setSelected((prev) => prev ? { ...prev, requestStatus: s } : null);
    }
  }

  const counts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.requestStatus] = (acc[r.requestStatus] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = filter === "ALL" ? requests : requests.filter((r) => r.requestStatus === filter);

  const tabs = [
    { key: "ALL",              label: "All" },
    { key: "PENDING_INTAKE",   label: "Pending" },
    { key: "APPROVED",         label: "Approved" },
    { key: "REJECTED",         label: "Rejected" },
    { key: "CONVERTED_TO_JOB", label: "Converted" },
  ];

  return (
    <>
      {/* filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {tabs.map((tab) => {
          const count = tab.key === "ALL"
            ? requests.length
            : (counts[tab.key] ?? 0);
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors
                ${active
                  ? "bg-slate-800 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400 text-sm">
          No requests in this category.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Request #</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Device</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Handover</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => setSelected(req)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-700 whitespace-nowrap">
                    {req.requestNumber}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-800">{req.customerName}</div>
                    <div className="text-xs text-slate-400">{req.phone}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-slate-800">{req.brand} {req.model && <span className="text-slate-500">{req.model}</span>}</div>
                    <div className="text-xs text-slate-400">{DEVICE_LABEL[req.deviceType] ?? req.deviceType}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-slate-600">{HANDOVER_LABEL[req.handoverMethod] ?? req.handoverMethod}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={req.requestStatus} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                    {fmt(req.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <RowActions
                      req={req}
                      onStatusChange={handleStatusChange}
                      onView={() => setSelected(req)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <RequestDrawer
          req={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  );
}
