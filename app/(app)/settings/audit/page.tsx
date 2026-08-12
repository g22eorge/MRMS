import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";

export const dynamic = "force-dynamic";

function compactJson(value: string | null) {
  if (!value) return "-";
  try {
    return JSON.stringify(JSON.parse(value), null, 0).slice(0, 180);
  } catch {
    return value.slice(0, 180);
  }
}

export default async function SettingsAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (user.role !== "ADMIN") redirect("/settings");

  const params = await searchParams;
  const action = typeof params.action === "string" ? params.action.trim() : "";
  const page = parsePage(params.page);
  const exportHref = `/api/audit/export${action ? `?action=${encodeURIComponent(action)}` : ""}`;

  const eventsWhere = {
    orgId,
    ...(action ? { action } : {}),
  };

  const [eventsTotal, events, actionRows] = await Promise.all([
    prisma.systemAuditEvent.count({ where: eventsWhere }).catch(() => 0),
    prisma.systemAuditEvent
      .findMany({
        where: eventsWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          actorUserId: true,
          entityType: true,
          entityId: true,
          action: true,
          summary: true,
          afterJson: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    // Filter dropdown must list every action for the org, not just the current page.
    prisma.systemAuditEvent
      .findMany({ where: { orgId }, select: { action: true }, distinct: ["action"], orderBy: { action: "asc" } })
      .catch(() => []),
  ]);

  const pageView = paginationView(page, eventsTotal);
  const auditHref = pageHrefBuilder("/settings/audit", { action });

  const actorIds = Array.from(new Set(events.map((event) => event.actorUserId).filter(Boolean))) as string[];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds }, orgId }, select: { id: true, name: true, email: true } }).catch(() => [])
    : [];
  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
  const actionOptions = Array.from(new Set(actionRows.map((row) => row.action))).sort();

  const fmt = (d: Date) => d.toLocaleString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="dc-card overflow-hidden px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[0.8125rem] font-bold text-[var(--ink)]">Audit Timeline</p>
          </div>
          <a href={exportHref} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
            ↓ Export CSV
          </a>
        </div>
      </div>

      <form className="dc-card px-3 py-2.5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select name="action" defaultValue={action} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]">
            <option value="">All actions</option>
            {actionOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button type="submit" className="btn-premium-secondary rounded-lg px-4 py-2 text-sm font-semibold">
            Apply filter
          </button>
        </div>
      </form>

      <DataTable
        className="doc-list"
        rows={events}
        getRowKey={(event) => event.id}
        empty="No audit events found. New commercial and admin actions will appear here once recorded."
        columns={[
          {
            key: "when",
            header: "When",
            className: "whitespace-nowrap align-top text-[0.75rem] text-[var(--ink-muted)]",
            cell: (event) => fmt(event.createdAt),
          },
          {
            key: "action",
            header: "Action",
            className: "align-top",
            cell: (event) => (
              <>
                <p className="mono font-semibold text-[var(--ink)]">{event.action}</p>
                <p className="mt-1 max-w-[240px] text-[0.75rem] text-[var(--ink-muted)]">{event.summary ?? "-"}</p>
              </>
            ),
          },
          {
            key: "actor",
            header: "Actor",
            className: "align-top text-[0.75rem] text-[var(--ink-muted)]",
            cell: (event) => {
              const actor = event.actorUserId ? actorMap.get(event.actorUserId) : null;
              return actor ? (
                <span>{actor.name}<br /><span className="mono">{actor.email}</span></span>
              ) : (
                event.actorUserId ?? "-"
              );
            },
          },
          {
            key: "entity",
            header: "Entity",
            className: "align-top",
            cell: (event) => (
              <>
                <p className="font-semibold text-[var(--ink)]">{event.entityType}</p>
                <p className="mono text-[var(--ink-muted)]">{event.entityId}</p>
              </>
            ),
          },
          {
            key: "after",
            header: "After",
            className: "max-w-[260px] align-top mono text-[0.75rem] text-[var(--ink-muted)]",
            cell: (event) => compactJson(event.afterJson),
          },
        ]}
        renderMobileCard={(event) => {
          const actor = event.actorUserId ? actorMap.get(event.actorUserId) : null;
          return (
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="mono truncate font-semibold text-[var(--ink)]">{event.action}</p>
                <span className="shrink-0 whitespace-nowrap text-[0.75rem] text-[var(--ink-muted)]">{fmt(event.createdAt)}</span>
              </div>
              {event.summary && <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">{event.summary}</p>}
              <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">{actor ? actor.name : event.actorUserId ?? "-"} · {event.entityType}</p>
              <p className="mono mt-1 truncate text-[0.75rem] text-[var(--ink-muted)]">{compactJson(event.afterJson)}</p>
            </div>
          );
        }}
      />

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="events"
        hrefForPage={auditHref}
      />
    </div>
  );
}
