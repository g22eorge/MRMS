import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PLATFORM_ROUTES } from "@/lib/platform/routes";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import {parsePage, paginationView, pageHrefBuilder, PAGE_SIZE, parsePageSize, sizeHrefBuilder} from "@/lib/pagination";

export const dynamic = "force-dynamic";

function compactJson(value: string | null) {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 0).slice(0, 220);
  } catch {
    return value.slice(0, 220);
  }
}

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; action?: string; page?: string; size?: string; }>;
}) {
  await requirePlatformAdmin();

  const params = await searchParams;
  const orgId = typeof params.orgId === "string" ? params.orgId.trim() : "";
  const action = typeof params.action === "string" ? params.action.trim() : "";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);
  const exportParams = new URLSearchParams({ scope: "platform" });
  if (orgId) exportParams.set("orgId", orgId);
  if (action) exportParams.set("action", action);
  const exportHref = `/api/audit/export?${exportParams.toString()}`;

  const events = await prisma.systemAuditEvent
    .findMany({
      where: {
        ...(orgId ? { orgId } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        orgId: true,
        actorUserId: true,
        entityType: true,
        entityId: true,
        action: true,
        summary: true,
        beforeJson: true,
        afterJson: true,
        createdAt: true,
      },
    })
    .catch(() => []);

  const actorIds = Array.from(new Set(events.map((event) => event.actorUserId).filter(Boolean))) as string[];
  const orgIds = Array.from(new Set(events.map((event) => event.orgId).filter(Boolean))) as string[];
  const [actors, orgs] = await Promise.all([
    actorIds.length
      ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }).catch(() => [])
      : Promise.resolve([]),
    orgIds.length
      ? prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true, slug: true } }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
  const orgMap = new Map(orgs.map((org) => [org.id, org]));
  const actionOptions = Array.from(new Set(events.map((event) => event.action))).sort();

  // Filter options and lookup maps are derived from the full fetched dataset;
  // only the displayed rows are paginated below.
  const pageView = paginationView(page, events.length, pageSize);
  const pageRows = events.slice(pageView.skip, pageView.skip + pageView.take);
  const auditHrefFilters = { orgId, action,
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const auditHref = pageHrefBuilder("/platform/audit", auditHrefFilters);
  const auditHrefSize = sizeHrefBuilder("/platform/audit", auditHrefFilters);

  const fmt = (d: Date) => d.toLocaleString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">System Audit</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Recent commercial and platform-sensitive events.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={exportHref} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Export CSV
          </a>
          <Link href={PLATFORM_ROUTES.home} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Organisations
          </Link>
        </div>
      </div>

      <form className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input name="orgId" defaultValue={orgId} placeholder="Filter by org ID" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]" />
          <select name="action" defaultValue={action} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]">
            <option value="">All actions</option>
            {actionOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-[var(--accent)]/20 px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/30">
            Apply filters
          </button>
        </div>
      </form>

      <DataTable
        rows={pageRows}
        getRowKey={(event) => event.id}
        empty={
          <>
            No audit events found. If the table is missing, run <span className="mono">/api/admin/db-fix</span> or deploy the latest schema.
          </>
        }
        columns={[
          {
            key: "when",
            header: "When",
            className: "align-top whitespace-nowrap text-[0.75rem] text-[var(--ink-muted)]",
            cell: (event) => fmt(event.createdAt),
          },
          {
            key: "action",
            header: "Action",
            className: "align-top",
            cell: (event) => (
              <>
                <p className="mono font-semibold text-[var(--ink)]">{event.action}</p>
                <p className="mt-1 max-w-[220px] text-[0.75rem] text-[var(--ink-muted)]">{event.summary ?? "—"}</p>
              </>
            ),
          },
          {
            key: "org",
            header: "Org",
            className: "align-top",
            cell: (event) => {
              const org = event.orgId ? orgMap.get(event.orgId) : null;
              return org ? (
                <Link href={PLATFORM_ROUTES.org(org.id)} className="font-medium text-[var(--ink)] hover:underline">{org.name}</Link>
              ) : (
                <span className="mono text-[0.75rem] text-[var(--ink-muted)]">{event.orgId ?? "—"}</span>
              );
            },
          },
          {
            key: "actor",
            header: "Actor",
            className: "align-top text-[0.75rem] text-[var(--ink-muted)]",
            cell: (event) => {
              const actor = event.actorUserId ? actorMap.get(event.actorUserId) : null;
              return actor ? <span>{actor.name}<br /><span className="mono">{actor.email}</span></span> : event.actorUserId ?? "—";
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
            className: "align-top max-w-[260px] mono text-[0.75rem] text-[var(--ink-muted)]",
            cell: (event) => compactJson(event.afterJson),
          },
        ]}
      />

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="events"
        hrefForPage={auditHref}
          pageSize={pageSize}
          hrefForSize={auditHrefSize}
      />
    </div>
  );
}
