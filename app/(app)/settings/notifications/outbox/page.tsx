import { redirect } from "next/navigation";
import Link from "next/link";

import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { RowActionsMenu, MenuActionButton, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";

import { Prisma, OutboundMessageChannel, OutboundMessageStatus, OutboundMessageType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { revalidateCommunicationsOutbox } from "@/lib/communications/revalidate";
import { deliverOutboundMessageForOrg, getOutboxRetryLimit, retryDueOutboundMessages } from "@/lib/notifications/whatsapp-outbox";

export const dynamic = "force-dynamic";

type SearchParams = {
  channel?: string;
  status?: string;
  type?: string;
  q?: string;
  page?: string;
};

const CHANNELS = Object.values(OutboundMessageChannel);
const STATUSES = Object.values(OutboundMessageStatus);
const TYPES = Object.values(OutboundMessageType);

const PAGE_SIZE = 20;

// Borderless status pills — semantic colour via tint + text, no ring.
const STATUS_STYLES: Record<string, string> = {
  SENT:    "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  PENDING: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  FAILED:  "bg-red-500/12 text-red-600 dark:text-red-400",
  DEAD:    "bg-[var(--panel-strong)] text-[var(--ink-muted)]",
};

const CHANNEL_DOT: Record<string, string> = {
  WHATSAPP: "bg-[#25D366]",
  EMAIL:    "bg-blue-500",
};

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL:    "Email",
};

function isGoodDelivery(status: string | null | undefined) {
  return status === "delivered" || status === "read";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.75rem] font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.DEAD}`}>
      {status}
    </span>
  );
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-UG", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (!(user.role === "ADMIN" || user.role === "OPS")) {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const channel = CHANNELS.includes(filters.channel as OutboundMessageChannel)
    ? (filters.channel as OutboundMessageChannel)
    : null;
  const status = STATUSES.includes(filters.status as OutboundMessageStatus)
    ? (filters.status as OutboundMessageStatus)
    : null;
  const type = TYPES.includes(filters.type as OutboundMessageType)
    ? (filters.type as OutboundMessageType)
    : null;
  const q = typeof filters.q === "string" ? filters.q.trim() : "";
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);

  const where: Prisma.OutboundMessageWhereInput = {
    orgId,
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q } },
            { to: { contains: q } },
            { providerMessageId: { contains: q } },
            { lastError: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, counts, filteredTotal] = await Promise.all([
    prisma.outboundMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        channel: true,
        type: true,
        status: true,
        to: true,
        nextAttemptAt: true,
        sentAt: true,
        providerDeliveryStatus: true,
        lastErrorCode: true,
        lastError: true,
      },
    }),
    prisma.outboundMessage.groupBy({
      by: ["status"],
      _count: { status: true },
      where: { orgId },
    }),
    prisma.outboundMessage.count({ where }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count.status]));
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const rangeStart = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredTotal);

  // Preserve active filters when moving between pages.
  function pageHref(targetPage: number) {
    const params = new URLSearchParams({
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
      ...(targetPage > 1 ? { page: String(targetPage) } : {}),
    });
    const qs = params.toString();
    return qs ? `${COMMUNICATIONS_ROUTES.outbox}?${qs}` : COMMUNICATIONS_ROUTES.outbox;
  }

  async function retryNowAction() {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(user.role === "ADMIN" || user.role === "OPS")) redirect("/dashboard");
    await retryDueOutboundMessages(getOutboxRetryLimit(25), { orgId });
    revalidateCommunicationsOutbox();
  }

  async function retryOneAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(user.role === "ADMIN" || user.role === "OPS")) redirect("/dashboard");
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await deliverOutboundMessageForOrg(id, orgId);
    revalidateCommunicationsOutbox();
  }

  async function markDeadAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(user.role === "ADMIN" || user.role === "OPS")) redirect("/dashboard");
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await prisma.outboundMessage.updateMany({
      where: { id, orgId },
      data: { status: "DEAD", nextAttemptAt: new Date(0), lockedAt: null },
    });
    revalidateCommunicationsOutbox();
  }

  const totalCount = counts.reduce((sum, c) => sum + c._count.status, 0);

  // Named so the same overflow menu renders in the desktop table AND mobile card.
  const renderRowActions = (r: (typeof rows)[number]) => {
    if (r.status === "SENT") return null;
    const canDiscard = r.status !== "DEAD";
    return (
      <RowActionsMenu label="Message actions" size="compact">
        <div className="px-3 py-1">
          <form action={retryOneAction}>
            <input type="hidden" name="id" value={r.id} />
            <MenuActionButton icon="whatsapp">Retry Now</MenuActionButton>
          </form>
        </div>
        {canDiscard ? (
          <MenuDestructiveRow>
            <form action={markDeadAction}>
              <input type="hidden" name="id" value={r.id} />
              <ConfirmSubmitButton
                message="Discard this message? It will be marked failed (DEAD) and won't be retried."
                confirmLabel="Discard"
                className="w-full text-left text-[0.75rem] text-red-600"
              >
                Discard
              </ConfirmSubmitButton>
            </form>
          </MenuDestructiveRow>
        ) : null}
      </RowActionsMenu>
    );
  };

  return (
    <div className="space-y-4">
      {/* Status filters + search + actions */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* Status segmented control */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]/60 p-1">
          {[
            { label: "All", key: "", count: totalCount },
            { label: "Sent", key: "SENT", count: byStatus.SENT ?? 0 },
            { label: "Pending", key: "PENDING", count: byStatus.PENDING ?? 0 },
            { label: "Failed", key: "FAILED", count: byStatus.FAILED ?? 0 },
            { label: "Dead", key: "DEAD", count: byStatus.DEAD ?? 0 },
          ].map(({ label, key, count }) => {
            const active = (status ?? "") === key;
            const href = `${COMMUNICATIONS_ROUTES.outbox}?${new URLSearchParams({ ...(channel ? { channel } : {}), ...(q ? { q } : {}), ...(key ? { status: key } : {}) }).toString()}`;
            return (
              <Link
                key={key || "all"}
                href={href}
                aria-current={active ? "true" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold transition ${
                  active
                    ? "bg-[var(--accent)] text-black shadow-sm"
                    : "text-[var(--ink-muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
                }`}
              >
                {label}
                <span className={`tabular-nums ${active ? "text-black/60" : "text-[var(--ink-muted)]/60"}`}>{count}</span>
              </Link>
            );
          })}
        </div>

        {/* Search + actions */}
        <div className="flex shrink-0 items-center gap-2">
          <form method="get" action={COMMUNICATIONS_ROUTES.outbox} className="relative">
            {channel ? <input type="hidden" name="channel" value={channel} /> : null}
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <svg
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]/60"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search recipient or error"
              className="h-9 w-40 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] pl-8 pr-3 text-[0.8125rem] text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15 sm:w-56"
            />
          </form>
          <Link
            href={COMMUNICATIONS_ROUTES.preferences}
            className="hidden h-9 items-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-[0.8125rem] font-semibold text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--ink)] sm:inline-flex"
          >
            Preferences
          </Link>
          <form action={retryNowAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 text-[0.8125rem] font-bold text-black transition hover:brightness-105"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              Run Retry
            </button>
          </form>
        </div>
      </div>

      {/* Table */}
      <DataTable
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No messages match these filters."
        renderMobileCard={(r) => (
          <div className="flex items-center gap-3 px-4 py-2.5">
            <StatusPill status={r.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate mono text-[0.8125rem] font-medium text-[var(--ink)]">{r.to}</p>
              <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
                {CHANNEL_LABEL[r.channel] ?? r.channel} · {r.type.replaceAll("_", " ").toLowerCase()}
                {r.lastError ? <span className="text-red-600 dark:text-red-400"> · failed</span> : r.sentAt ? ` · ${fmtDate(r.sentAt)}` : ""}
              </p>
            </div>
            <div className="shrink-0">{renderRowActions(r)}</div>
          </div>
        )}
        columns={[
          {
            key: "status",
            header: "Status",
            cell: (r) => <StatusPill status={r.status} />,
          },
          {
            key: "recipient",
            header: "Recipient",
            className: "whitespace-nowrap mono font-medium text-[var(--ink)]",
            cell: (r) => r.to,
          },
          {
            key: "message",
            header: "Message",
            cell: (r) => (
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CHANNEL_DOT[r.channel] ?? "bg-[var(--ink-muted)]"}`} />
                <span className="text-[var(--ink-muted)]">{r.type.replaceAll("_", " ").toLowerCase()}</span>
              </span>
            ),
          },
          {
            key: "when",
            header: "When",
            className: "whitespace-nowrap text-[var(--ink-muted)]",
            cell: (r) =>
              r.sentAt
                ? fmtDate(r.sentAt)
                : r.nextAttemptAt && r.nextAttemptAt > new Date()
                  ? <span className="text-amber-600 dark:text-amber-400">Due {fmtDate(r.nextAttemptAt)}</span>
                  : "—",
          },
          {
            key: "result",
            header: "Result",
            className: "max-w-[260px] truncate",
            cell: (r) =>
              r.lastError ? (
                <span className="text-red-600 dark:text-red-400" title={`${r.lastErrorCode ? `[${r.lastErrorCode}] ` : ""}${r.lastError}`}>
                  {r.lastErrorCode ? `${r.lastErrorCode}: ` : ""}{r.lastError}
                </span>
              ) : r.providerDeliveryStatus ? (
                <span className={isGoodDelivery(r.providerDeliveryStatus) ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--ink-muted)]"}>
                  {r.providerDeliveryStatus}
                </span>
              ) : (
                <span className="text-[var(--ink-muted)]/60">—</span>
              ),
          },
        ]}
        actions={renderRowActions}
      />

      {/* Pagination */}
      <TablePagination
        page={page}
        totalPages={totalPages}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        total={filteredTotal}
        unit="messages"
        hrefForPage={pageHref}
      />
    </div>
  );
}
