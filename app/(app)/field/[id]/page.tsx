import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FieldVisitStatus } from "@prisma/client";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { formatEATDateTime } from "@/lib/date-eat";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { VisitActions } from "./VisitActions";

const STATUS_LABELS: Record<FieldVisitStatus, string> = {
  SCHEDULED: "Scheduled",
  EN_ROUTE: "En Route",
  ARRIVED: "Arrived",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};


const TYPE_LABELS: Record<string, string> = {
  COLLECTION: "Collection",
  DELIVERY: "Delivery",
  ONSITE_REPAIR: "Onsite Repair",
  ASSESSMENT: "Assessment",
  FOLLOWUP: "Follow-up",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-3 border-b border-[var(--line)] last:border-0 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-[var(--ink-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--ink)] sm:col-span-2">{value ?? <span className="text-[var(--ink-muted)]">—</span>}</dd>
    </div>
  );
}

export default async function FieldVisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, orgId } = await requireOrgSession();

  const isManager = can.manageFieldVisits(user);
  const isFieldTech = can.recordFieldSignoffs(user);

  if (!isManager && !isFieldTech) {
    redirect("/");
  }

  const visit = await prisma.fieldVisit.findFirst({
    where: { id, orgId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      scheduledBy: { select: { id: true, name: true } },
      job: {
        select: {
          id: true,
          jobNumber: true,
          brand: true,
          model: true,
          deviceType: true,
          ...(isManager ? { client: { select: { fullName: true, phone: true } } } : {}),
        },
      },
    },
  }).catch(() => null);

  if (!visit) {
    notFound();
  }

  if (!isManager && visit.assignedToId !== user.id) {
    redirect("/field");
  }

  const canAct =
    isManager ||
    (isFieldTech && visit.assignedToId === user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <RecordActionBar
        backHref="/field"
        eyebrow="Field · Visit"
        title={`${TYPE_LABELS[visit.type] ?? visit.type} Visit`}
        status={{ label: STATUS_LABELS[visit.status], tone: visit.status === "COMPLETED" ? "success" : visit.status === "CANCELLED" || visit.status === "FAILED" ? "danger" : visit.status === "EN_ROUTE" || visit.status === "ARRIVED" ? "warning" : "sky" }}
      />
      <p className="text-sm text-[var(--ink-muted)]">Scheduled {formatEATDateTime(visit.scheduledAt)}</p>

      {visit.job && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--ink-muted)]">Linked Job</p>
          <dl className="divide-y divide-[var(--line)]">
            <DetailRow
              label="Job Number"
              value={
                <Link href={`/jobs/${visit.job.id}`} className="text-[var(--accent)] hover:underline">
                  {visit.job.jobNumber}
                </Link>
              }
            />
            <DetailRow label="Device" value={`${visit.job.brand} ${visit.job.model}`} />
            {isManager && visit.job.client && (
              <DetailRow label="Client" value={`${visit.job.client.fullName} — ${visit.job.client.phone}`} />
            )}
          </dl>
        </div>
      )}

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--ink-muted)]">Visit Details</p>
        <dl className="divide-y divide-[var(--line)]">
          <DetailRow label="Type" value={TYPE_LABELS[visit.type] ?? visit.type} />
          <DetailRow label="Assigned To" value={visit.assignedTo.name} />
          <DetailRow label="Scheduled By" value={visit.scheduledBy.name} />
          <DetailRow label="Scheduled At" value={formatEATDateTime(visit.scheduledAt)} />
          {visit.startedAt && (
            <DetailRow label="Started At" value={formatEATDateTime(visit.startedAt)} />
          )}
          {visit.completedAt && (
            <DetailRow label="Completed At" value={formatEATDateTime(visit.completedAt)} />
          )}
        </dl>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--ink-muted)]">Location & Contact</p>
        <dl className="divide-y divide-[var(--line)]">
          <DetailRow label="Address" value={visit.address} />
          {(visit.gpsLat && visit.gpsLng) && (
            <DetailRow
              label="GPS"
              value={
                <a
                  href={`https://www.google.com/maps?q=${visit.gpsLat},${visit.gpsLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  {visit.gpsLat.toFixed(5)}, {visit.gpsLng.toFixed(5)}
                </a>
              }
            />
          )}
          <DetailRow label="Contact Name" value={visit.contactName} />
          <DetailRow label="Contact Phone" value={visit.contactPhone} />
        </dl>
      </div>

      {(visit.notes || visit.outcomeNotes || visit.signoffName) && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--ink-muted)]">Notes & Sign-off</p>
          <dl className="divide-y divide-[var(--line)]">
            {visit.notes && <DetailRow label="Notes" value={visit.notes} />}
            {visit.outcomeNotes && <DetailRow label="Outcome Notes" value={visit.outcomeNotes} />}
            {visit.signoffName && <DetailRow label="Signed Off By" value={visit.signoffName} />}
            {visit.signoffAt && <DetailRow label="Signed Off At" value={formatEATDateTime(visit.signoffAt)} />}
          </dl>
        </div>
      )}

      {canAct && !["COMPLETED", "FAILED", "CANCELLED"].includes(visit.status) && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wide text-[var(--ink-muted)]">Actions</p>
          <VisitActions
            visitId={visit.id}
            status={visit.status}
            isManager={isManager}
            isFieldTech={isFieldTech}
          />
        </div>
      )}
    </div>
  );
}
