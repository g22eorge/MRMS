import Link from "next/link";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ProgressiveList } from "@/components/mobile/ProgressiveList";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { getCurrentUserRole } from "@/lib/session";
import { formatEATDate } from "@/lib/date-eat";

const createClientSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(3),
  email: z.string().optional(),
  organization: z.string().optional(),
});

type SearchParams = {
  q?: string;
  segment?: string;
  page?: string;
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await getCurrentUserRole();
  if (!can.viewClientInfo(user)) {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const page = Math.max(Number(filters.page ?? "1") || 1, 1);
  const pageSize = 20;
  const segment = filters.segment ?? "all";

  const where: Prisma.ClientWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { fullName: { contains: filters.q } },
            { phone: { contains: filters.q } },
            { email: { contains: filters.q } },
            { organization: { contains: filters.q } },
          ],
        }
      : {}),
  };

  const [matchingClients, allCounts] = await Promise.all([
    prisma.client.findMany({
      where,
      include: { _count: { select: { jobs: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.client.findMany({ include: { _count: { select: { jobs: true } } } }),
  ]);

  type ClientRow = Prisma.ClientGetPayload<{
    include: { _count: { select: { jobs: true } } };
  }>;

  const segmentedClients = (matchingClients as ClientRow[]).filter((client) => {
    if (segment === "active") return client._count.jobs > 0;
    if (segment === "new") return client._count.jobs === 0;
    if (segment === "high") return client._count.jobs >= 3;
    return true;
  });

  const total = segmentedClients.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);
  const prevPage = Math.max(page - 1, 1);
  const nextPage = Math.min(page + 1, totalPages);
  const isPrevDisabled = page <= 1;
  const isNextDisabled = page >= totalPages;
  const clients = segmentedClients.slice((page - 1) * pageSize, page * pageSize);
  const totalClients = allCounts.length;
  const activeClients = allCounts.filter((c) => c._count.jobs > 0).length;
  const newClients = allCounts.filter((c) => c._count.jobs === 0).length;
  const withManyJobs = allCounts.filter((c) => c._count.jobs >= 3).length;

  async function createClientAction(formData: FormData) {
    "use server";

    const { user: currentUser } = await getCurrentUserRole();
    if (!(currentUser.role === "ADMIN" || currentUser.role === "OPS")) return;

    const parsed = createClientSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      organization: String(formData.get("organization") ?? ""),
    });

    if (!parsed.success) return;

    const normalizedPhone = sanitizeText(parsed.data.phone);
    const existingByPhone = await prisma.client.findFirst({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    if (existingByPhone) return;

    await prisma.client.create({
      data: {
        fullName: sanitizeText(parsed.data.fullName),
        phone: normalizedPhone,
        email: sanitizeOptionalText(parsed.data.email),
        organization: sanitizeOptionalText(parsed.data.organization),
      },
    });

    revalidatePath("/clients");
  }

  async function deleteClientAction(formData: FormData) {
    "use server";

    const { user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const clientWithJobs = await prisma.client.findUnique({
      where: { id },
      include: { _count: { select: { jobs: true } } },
    });

    if (!clientWithJobs || clientWithJobs._count.jobs > 0) return;
    await prisma.client.delete({ where: { id } });
    revalidatePath("/clients");
  }

  const preserved = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => typeof value === "string" && value.length > 0),
  ) as Record<string, string>;
  const hasClientFilters = Boolean(filters.q || segment !== "all");
  const clientBrief = hasClientFilters
    ? "Filtered client directory view is active. Use the KPI cards below for live totals and reset filters to return to the full book."
    : "Use this directory to maintain accurate contact records, monitor client activity, and quickly open each customer timeline.";
  const controlClass =
    "rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";
  const fieldClass =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";

  return (
    <div className="space-y-4">
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">Client Brief</p>
          <p className="mt-1 text-sm text-[var(--ink)] [overflow-wrap:anywhere]">{clientBrief}</p>
        </div>
      </div>

      <div className="panel-shadow sticky top-14 z-20 grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 py-2 2xl:hidden">
        <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Total</p>
          <p className="text-sm font-semibold">{totalClients}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Active</p>
          <p className="text-sm font-semibold text-[var(--brand)]">{activeClients}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">No Job</p>
          <p className="text-sm font-semibold">{newClients}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">3+ Jobs</p>
          <p className="text-sm font-semibold text-[#D4AF37]">{withManyJobs}</p>
        </div>
      </div>

      <div className="hidden gap-3 2xl:grid 2xl:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Total clients</p>
          <p className="text-2xl font-semibold">{totalClients}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Active clients</p>
          <p className="text-2xl font-semibold text-[var(--brand)]">{activeClients}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">No job yet</p>
          <p className="text-2xl font-semibold">{newClients}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">3+ jobs</p>
          <p className="text-2xl font-semibold text-[#D4AF37]">{withManyJobs}</p>
        </div>
      </div>

      {(user.role === "ADMIN" || user.role === "OPS") ? (
        <>
          <details className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 2xl:hidden" open>
            <summary className="list-none">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Quick Create Client</p>
                <span className="text-[11px] text-[var(--ink-muted)]">Tap to fold</span>
              </div>
            </summary>
            <form action={createClientAction} className="mt-3 space-y-2">
              <input required name="fullName" placeholder="Full name" className={fieldClass} />
              <input required name="phone" placeholder="Phone" className={fieldClass} />
              <details className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] p-2">
                <summary className="list-none text-xs font-medium text-[var(--ink-muted)]">Optional details</summary>
                <div className="mt-2 grid gap-2">
                  <input name="email" placeholder="Email" className={fieldClass} />
                  <input name="organization" placeholder="Organization" className={fieldClass} />
                </div>
              </details>
              <button className="btn-premium w-full rounded-lg px-3 py-2 text-sm">Create Client</button>
            </form>
          </details>

          <form action={createClientAction} className="panel-shadow hidden space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 2xl:block">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Create client</p>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
              <input required name="fullName" placeholder="Full name" className={controlClass} />
              <input required name="phone" placeholder="Phone" className={controlClass} />
              <input name="email" placeholder="Email" className={controlClass} />
              <input name="organization" placeholder="Organization" className={controlClass} />
              <button className="btn-premium justify-self-start rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Create</button>
            </div>
          </form>
        </>
      ) : null}

      <form className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 2xl:hidden">
        <input
          name="q"
          defaultValue={filters.q}
          aria-label="Search clients"
          placeholder="Search clients and press Enter"
          className={fieldClass}
        />
      </form>

      <form className="panel-shadow hidden gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 2xl:grid 2xl:grid-cols-3">
        <input
          name="q"
          defaultValue={filters.q}
          aria-label="Search clients"
          placeholder="Search by name, phone, email, or organization"
          className={controlClass}
        />
        <select name="segment" defaultValue={segment} className={controlClass}>
          <option value="all">All clients</option>
          <option value="active">Active clients</option>
          <option value="new">No-job clients</option>
          <option value="high">3+ jobs clients</option>
        </select>
        <button className="btn-premium-secondary justify-self-start rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Apply</button>
        <Link href="/clients" className="btn-premium-secondary justify-self-start rounded-lg px-3 py-1.5 text-[13px] text-center sm:py-2 sm:text-sm">Reset</Link>
      </form>

      <div className="flex flex-wrap gap-2 text-xs max-[360px]:grid max-[360px]:grid-cols-2">
        <Link href={`/clients?segment=all${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`} className={`rounded-full px-3 py-1 text-center ${segment === "all" ? "bg-[var(--brand)] text-white" : "bg-[var(--panel)] text-[var(--ink-muted)]"}`}>All</Link>
        <Link href={`/clients?segment=active${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`} className={`rounded-full px-3 py-1 text-center ${segment === "active" ? "bg-[var(--brand)] text-white" : "bg-[var(--panel)] text-[var(--ink-muted)]"}`}>Active</Link>
        <Link href={`/clients?segment=new${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`} className={`rounded-full px-3 py-1 text-center ${segment === "new" ? "bg-[var(--brand)] text-white" : "bg-[var(--panel)] text-[var(--ink-muted)]"}`}>No Job Yet</Link>
        <Link href={`/clients?segment=high${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`} className={`rounded-full px-3 py-1 text-center ${segment === "high" ? "bg-[var(--brand)] text-white" : "bg-[var(--panel)] text-[var(--ink-muted)]"}`}>High Activity</Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-white p-6 text-sm text-[var(--ink-muted)]">No clients match this view.</div>
      ) : (
        <div className="panel-shadow overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="space-y-3 p-3 lg:hidden">
            <ProgressiveList initialCount={5} step={5}>
              {(clients as ClientRow[]).map((client) => (
                <details key={client.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3 max-[360px]:p-2.5">
                <summary className="list-none">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{client.fullName}</p>
                      <p className="truncate text-xs text-[var(--ink-muted)]">{client.phone}</p>
                      <p className="truncate text-[11px] text-[var(--ink-muted)]">{client.organization || "No organization"}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">Jobs {client._count.jobs}</span>
                  </div>
                </summary>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[var(--ink-muted)]">Organization</p>
                    <p className="truncate font-medium text-[var(--ink)]">{client.organization ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[var(--ink-muted)]">Email</p>
                    <p className="truncate font-medium text-[var(--ink)]">{client.email ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[var(--ink-muted)]">Updated</p>
                    <p className="font-medium text-[var(--ink)]">{formatEATDate(client.updatedAt)}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 max-[360px]:grid max-[360px]:grid-cols-2">
                  <Link
                    href={`/clients/${client.id}`}
                    className="btn-premium flex-1 rounded-md px-3 py-1.5 text-center text-[13px] font-medium sm:py-2 sm:text-sm"
                  >
                    Open
                  </Link>
                  {user.role === "ADMIN" ? (
                    <form action={deleteClientAction} className="flex-1 max-[360px]:col-span-2">
                      <input type="hidden" name="id" value={client.id} />
                      <button
                        disabled={client._count.jobs > 0}
                        className="btn-premium-danger w-full rounded-md px-3 py-1.5 text-[13px] font-medium disabled:border-[var(--line)] disabled:bg-[var(--panel)] disabled:text-[var(--ink-muted)] sm:py-2 sm:text-sm"
                      >
                        Delete
                      </button>
                    </form>
                  ) : null}
                </div>
                </details>
              ))}
            </ProgressiveList>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[920px] w-full border-collapse text-sm">
              <thead className="bg-[var(--panel-strong)] text-left text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Jobs</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(clients as ClientRow[]).map((client) => (
                  <tr key={`desktop-${client.id}`} className="align-middle text-[var(--ink)]">
                    <td className="border-t border-[var(--line)] px-4 py-3 font-medium">{client.fullName}</td>
                    <td className="border-t border-[var(--line)] px-4 py-3">{client.phone}</td>
                    <td className="border-t border-[var(--line)] px-4 py-3">{client.email ?? "-"}</td>
                    <td className="border-t border-[var(--line)] px-4 py-3">{client.organization ?? "-"}</td>
                    <td className="border-t border-[var(--line)] px-4 py-3">{client._count.jobs}</td>
                    <td className="border-t border-[var(--line)] px-4 py-3">{client.updatedAt.toLocaleDateString()}</td>
                    <td className="border-t border-[var(--line)] px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/clients/${client.id}`}
                          className="btn-premium rounded-md px-3 py-1.5 text-[13px]"
                        >
                          Open
                        </Link>
                        {user.role === "ADMIN" ? (
                          <form action={deleteClientAction}>
                            <input type="hidden" name="id" value={client.id} />
                            <button
                              disabled={client._count.jobs > 0}
                              className="btn-premium-danger rounded-md px-3 py-1.5 text-[13px] disabled:border-[var(--line)] disabled:bg-[var(--panel)] disabled:text-[var(--ink-muted)]"
                            >
                              Delete
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      <div className="panel-shadow flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm text-[var(--ink-muted)]">
        <p>
          Showing <span className="font-semibold text-[var(--ink)]">{pageStart}-{pageEnd}</span> of <span className="font-semibold text-[var(--ink)]">{total}</span>
        </p>
        <div className="flex gap-2">
          <Link
            href={`?${new URLSearchParams({ ...preserved, page: String(prevPage) }).toString()}`}
            aria-disabled={isPrevDisabled}
            className={`btn-premium-secondary rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm ${isPrevDisabled ? "pointer-events-none opacity-50" : ""}`}
          >
            Prev
          </Link>
          <span className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-xs font-medium text-[var(--ink-muted)]">
            Page {page} / {totalPages}
          </span>
          <Link
            href={`?${new URLSearchParams({ ...preserved, page: String(nextPage) }).toString()}`}
            aria-disabled={isNextDisabled}
            className={`btn-premium-secondary rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm ${isNextDisabled ? "pointer-events-none opacity-50" : ""}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
