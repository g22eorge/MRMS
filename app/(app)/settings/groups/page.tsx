import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrgSession } from "@/lib/org-context";
import { prisma } from "@/lib/prisma";
import { EXTRA_PERMISSIONS } from "@/lib/permissions";
import { assertOrgCanMutate } from "@/lib/org-write";
import { DataTable } from "@/components/ui/DataTable";
import { RowActionsMenu, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@/components/shared/Disclosure";

type SearchParams = { groupId?: string; new?: string };

const createGroupSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(240).optional().or(z.literal("")),
});

const updateGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(60),
  description: z.string().max(240).optional().or(z.literal("")),
});

const updateMembersSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

export default async function GroupsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user, orgId } = await requireOrgSession();
  if (user.role !== "ADMIN") redirect("/dashboard");

  async function createGroupAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (user.role !== "ADMIN") redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const parsed = createGroupSchema.safeParse({
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
    });
    if (!parsed.success) return;

    const created = await prisma.userGroup.create({
      data: {
        orgId,
        name: parsed.data.name,
        description: parsed.data.description ? parsed.data.description : null,
      },
      select: { id: true },
    });

    revalidatePath("/settings/groups");
    redirect(`/settings/groups?${new URLSearchParams({ groupId: created.id }).toString()}`);
  }

  async function updateGroupAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (user.role !== "ADMIN") redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const parsed = updateGroupSchema.safeParse({
      id: String(formData.get("id") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
    });
    if (!parsed.success) return;

    await prisma.userGroup.updateMany({
      where: { id: parsed.data.id, orgId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ? parsed.data.description : null,
      },
    });

    revalidatePath("/settings/groups");
    redirect(`/settings/groups?${new URLSearchParams({ groupId: parsed.data.id }).toString()}`);
  }

  async function deleteGroupAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (user.role !== "ADMIN") redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;
    await prisma.userGroup.deleteMany({ where: { id, orgId } });
    revalidatePath("/settings/groups");
    redirect("/settings/groups");
  }

  async function saveGroupPermissionsAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (user.role !== "ADMIN") redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    const perms = formData
      .getAll("permissions")
      .map((v) => String(v).trim())
      .filter((v): v is (typeof EXTRA_PERMISSIONS)[number] => EXTRA_PERMISSIONS.includes(v as (typeof EXTRA_PERMISSIONS)[number]));

    const group = await prisma.userGroup.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!group) return;

    await prisma.$transaction(async (tx) => {
      await tx.userGroupPermission.deleteMany({ where: { groupId: id } });
      if (perms.length > 0) {
        await tx.userGroupPermission.createMany({
          data: perms.map((permission) => ({ groupId: id, permission })),
        });
      }
    });

    revalidatePath("/settings/groups");
    redirect(`/settings/groups?${new URLSearchParams({ groupId: id }).toString()}`);
  }

  async function addMemberAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (user.role !== "ADMIN") redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    const parsed = updateMembersSchema.safeParse({
      id: String(formData.get("id") ?? "").trim(),
      userId: String(formData.get("userId") ?? "").trim(),
    });
    if (!parsed.success) return;

    const group = await prisma.userGroup.findFirst({ where: { id: parsed.data.id, orgId }, select: { id: true } });
    if (!group) return;
    const targetUser = await prisma.user.findFirst({ where: { id: parsed.data.userId, orgId }, select: { id: true } });
    if (!targetUser) return;

    await prisma.userGroupMember.create({ data: { groupId: group.id, userId: targetUser.id } }).catch(() => null);
    revalidatePath("/settings/groups");
    redirect(`/settings/groups?${new URLSearchParams({ groupId: group.id }).toString()}`);
  }

  async function removeMemberAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (user.role !== "ADMIN") redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    const id = String(formData.get("id") ?? "").trim();
    const memberId = String(formData.get("memberId") ?? "").trim();
    if (!id || !memberId) return;

    const group = await prisma.userGroup.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!group) return;
    await prisma.userGroupMember.deleteMany({ where: { id: memberId, groupId: group.id } });
    revalidatePath("/settings/groups");
    redirect(`/settings/groups?${new URLSearchParams({ groupId: group.id }).toString()}`);
  }

  const params = await searchParams;
  const groups = await prisma.userGroup.findMany({
    where: { orgId },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { members: true, permissions: true } },
    },
  }).catch(() => []);

  const selectedId = typeof params.groupId === "string" ? params.groupId : null;
  const selected = selectedId ? groups.find((g) => g.id === selectedId) ?? null : groups[0] ?? null;

  const [selectedMembers, selectedPerms, users] = selected
    ? await Promise.all([
        prisma.userGroupMember.findMany({
          where: { groupId: selected.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, user: { select: { id: true, name: true, email: true } } },
        }).catch(() => []),
        prisma.userGroupPermission.findMany({ where: { groupId: selected.id }, select: { permission: true } }).catch(() => []),
        prisma.user.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true }, take: 300 }),
      ])
    : [[], [], []];

  const selectedPermSet = new Set(selectedPerms.map((p) => p.permission));

  return (
    <section className="space-y-4">
      <div className="dc-card overflow-hidden px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[0.8125rem] font-bold text-[var(--ink)]">Permission Groups</p>
          </div>
          <Link href="/settings/users" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]">Users →</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="dc-card px-3 py-2.5">
          <Disclosure>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Groups</p>
            <DisclosureButton
              label="+ New"
              openLabel="✕ Cancel"
              className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)] px-3 py-1.5 text-[0.75rem] font-semibold text-black transition hover:bg-[var(--accent)]/90"
              openClassName="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
            />
          </div>
          <DisclosurePanel>
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <form action={createGroupAction} className="space-y-2">
                <input name="name" placeholder="Group name" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" required />
                <input name="description" placeholder="Description (optional)" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
                <button type="submit" className="btn-premium rounded-lg px-4 py-2 text-[0.8125rem]">Create Group</button>
              </form>
            </div>
          </DisclosurePanel>
          </Disclosure>

          <div className="mt-3 space-y-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/settings/groups?${new URLSearchParams({ groupId: g.id }).toString()}`}
                className={`block rounded-lg border px-3 py-2 transition ${selected?.id === g.id ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--line)] bg-[var(--panel-strong)] hover:border-[var(--accent)]/40"}`}
              >
                <p className="text-sm font-semibold text-[var(--ink)]">{g.name}</p>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{g._count.members} members · {g._count.permissions} permissions</p>
              </Link>
            ))}
            {groups.length === 0 ? (
              <p className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3 text-sm text-[var(--ink-muted)]">No groups yet.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="dc-card px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Group</p>
                  <RowActionsMenu label="Group actions" size="compact">
                    <MenuDestructiveRow>
                      <form action={deleteGroupAction}>
                        <input type="hidden" name="id" value={selected.id} />
                        <button type="submit" className="w-full text-left text-[0.75rem] text-red-600">Delete Group</button>
                      </form>
                    </MenuDestructiveRow>
                  </RowActionsMenu>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <form action={updateGroupAction} className="md:col-span-2 grid gap-2 md:grid-cols-2">
                    <input type="hidden" name="id" value={selected.id} />
                    <input name="name" defaultValue={selected.name} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none" required />
                    <input name="description" defaultValue={selected.description ?? ""} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none" placeholder="Description" />
                    <div className="md:col-span-2 flex items-center justify-between gap-2">
                      <button type="submit" className="btn-premium rounded-lg px-4 py-2 text-sm text-white">Save</button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="dc-card px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Members</p>
                <form action={addMemberAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={selected.id} />
                  <select name="userId" className="min-w-[240px] rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none">
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <button type="submit" className="btn-premium rounded-lg px-4 py-2 text-sm text-white">Add</button>
                </form>

                <div className="mt-3 overflow-hidden rounded-lg border border-[var(--line)]">
                  <DataTable
                    frameless
                    dense
                    rows={selectedMembers}
                    getRowKey={(m) => m.id}
                    empty="No members yet."
                    columns={[
                      {
                        key: "user",
                        header: "User",
                        cell: (m) => (
                          <>
                            <p className="font-medium">{m.user.name}</p>
                            <p className="text-[0.75rem] text-[var(--ink-muted)]">{m.user.email}</p>
                          </>
                        ),
                      },
                    ]}
                    actions={(m) => (
                      <RowActionsMenu label="Member actions" size="compact">
                        <MenuDestructiveRow>
                          <form action={removeMemberAction}>
                            <input type="hidden" name="id" value={selected.id} />
                            <input type="hidden" name="memberId" value={m.id} />
                            <button type="submit" className="w-full text-left text-[0.75rem] text-red-600">Remove Member</button>
                          </form>
                        </MenuDestructiveRow>
                      </RowActionsMenu>
                    )}
                    renderMobileCard={(m) => (
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--ink)]">{m.user.name}</p>
                          <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">{m.user.email}</p>
                        </div>
                        <div className="shrink-0">
                          <RowActionsMenu label="Member actions" size="compact">
                            <MenuDestructiveRow>
                              <form action={removeMemberAction}>
                                <input type="hidden" name="id" value={selected.id} />
                                <input type="hidden" name="memberId" value={m.id} />
                                <button type="submit" className="w-full text-left text-[0.75rem] text-red-600">Remove Member</button>
                              </form>
                            </MenuDestructiveRow>
                          </RowActionsMenu>
                        </div>
                      </div>
                    )}
                  />
                </div>
              </div>

              <div className="dc-card px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Permissions</p>
                <form action={saveGroupPermissionsAction} className="mt-3 space-y-2">
                  <input type="hidden" name="id" value={selected.id} />
                  <div className="grid gap-2 md:grid-cols-2">
                    {EXTRA_PERMISSIONS.map((perm) => (
                      <label key={perm} className="flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-2.5">
                        <input type="checkbox" name="permissions" value={perm} defaultChecked={selectedPermSet.has(perm)} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--ink)]">{perm}</p>
                          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Granted to all group members.</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button type="submit" className="btn-premium rounded-lg px-4 py-2 text-sm text-white">Save Permissions</button>
                </form>
              </div>
            </>
          ) : (
            <div className="dc-card p-6 text-sm text-[var(--ink-muted)]">
              Create a group to get started.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
