import { hashPassword } from "better-auth/crypto";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ProgressiveList } from "@/components/mobile/ProgressiveList";
import { EXTRA_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { RoleActionButton, SubmitActionButton } from "@/components/settings/UserActionButtons";
import { UserDetailsForm } from "@/components/settings/UserDetailsForm";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
});

const updateRoleSchema = z.object({
  id: z.string().min(1),
  role: z.nativeEnum(Role),
});

const updateDetailsSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
});

const updatePasswordSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const togglePermissionSchema = z.object({
  id: z.string().min(1),
  permission: z.string().min(3),
  enabled: z.enum(["true", "false"]),
});

const applyPresetSchema = z.object({
  id: z.string().min(1),
  preset: z.enum(["standard", "extended_ops"]),
});

const EXTENDED_OPS_PRESET = [...EXTRA_PERMISSIONS];

type UserDetailsState = {
  error?: string;
  success?: string;
};

const roleChoices: Role[] = [
  Role.ADMIN,
  Role.OPS,
  Role.INTAKE,
  Role.TECHNICIAN_INTERNAL,
  Role.TECHNICIAN_EXTERNAL,
];

const roleDisplay: Partial<Record<Role, string>> = {
  ADMIN: "Admin",
  OPS: "Ops",
  INTAKE: "Intake",
  TECHNICIAN_INTERNAL: "Internal Tech",
  TECHNICIAN_EXTERNAL: "External Tech",
};

const safeRoleChoices = roleChoices.filter(
  (role): role is Role => typeof role === "string" && role.length > 0,
);

function prettyRole(role: Role) {
  return role.replaceAll("_", " ");
}

function roleLabel(role: Role) {
  return roleDisplay[role] ?? prettyRole(role);
}

export default async function UsersPage() {
  const { session, user } = await getCurrentUserRole();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  async function createUser(formData: FormData) {
    "use server";
    const { user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const parsed = createUserSchema.safeParse({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      phone: String(formData.get("phone") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "OPS"),
    });
    if (!parsed.success) return;

    const newUser = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone?.trim() || null,
        role: parsed.data.role,
        emailVerified: true,
      },
    });

    await prisma.account.create({
      data: {
        accountId: newUser.id,
        providerId: "credential",
        userId: newUser.id,
        password: await hashPassword(parsed.data.password),
      },
    });

    revalidatePath("/settings/users");
  }

  async function updateRole(formData: FormData) {
    "use server";
    const { user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const parsed = updateRoleSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      role: String(formData.get("role") ?? ""),
    });
    if (!parsed.success) return;
    await prisma.user.update({ where: { id: parsed.data.id }, data: { role: parsed.data.role } });

    revalidatePath("/settings/users");
  }

  async function updateDetails(_prevState: UserDetailsState, formData: FormData): Promise<UserDetailsState> {
    "use server";
    const { user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return { error: "Unauthorized action" };

    const parsed = updateDetailsSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      phone: String(formData.get("phone") ?? "").trim(),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid profile details" };

    const existingEmail = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existingEmail && existingEmail.id !== parsed.data.id) {
      return { error: "Email is already used by another user" };
    }

    try {
      await prisma.user.update({
        where: { id: parsed.data.id },
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone || null,
        },
      });
    } catch {
      return { error: "Could not update this user profile right now" };
    }

    revalidatePath("/settings/users");
    return { success: "Profile updated" };
  }

  async function deactivate(formData: FormData) {
    "use server";
    const { session, user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const id = String(formData.get("id"));
    if (!id || id === session.user.id) return;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!target || target.role === "ADMIN") return;

    await prisma.user.update({ where: { id }, data: { isActive: false } });

    revalidatePath("/settings/users");
  }

  async function reactivate(formData: FormData) {
    "use server";
    const { user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    await prisma.user.update({ where: { id }, data: { isActive: true } });
    revalidatePath("/settings/users");
  }

  async function deleteUser(formData: FormData) {
    "use server";
    const { session: currentSession, user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const id = String(formData.get("id") ?? "");
    if (!id || id === currentSession.user.id) return;

    const usage = await prisma.user.findUnique({
      where: { id },
      select: {
        role: true,
        _count: {
          select: {
            jobsCreated: true,
            jobsAssigned: true,
            payoutsMarked: true,
            auditLogs: true,
            clientNotes: true,
          },
        },
      },
    });

    if (!usage) return;
    if (usage.role === "ADMIN") return;

    const hasLinkedRecords =
      usage._count.jobsCreated > 0 ||
      usage._count.jobsAssigned > 0 ||
      usage._count.payoutsMarked > 0 ||
      usage._count.auditLogs > 0 ||
      usage._count.clientNotes > 0;

    if (hasLinkedRecords) {
      await prisma.user.update({ where: { id }, data: { isActive: false } });
      revalidatePath("/settings/users");
      return;
    }

    await prisma.user.delete({ where: { id } });
    revalidatePath("/settings/users");
  }

  async function updatePassword(formData: FormData) {
    "use server";
    const { user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const parsed = updatePasswordSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    if (!parsed.success) return;

    const hashedPassword = await hashPassword(parsed.data.password);
    const existingCredentialAccount = await prisma.account.findFirst({
      where: { userId: parsed.data.id, providerId: "credential" },
      select: { id: true },
    });

    if (existingCredentialAccount) {
      await prisma.account.update({
        where: { id: existingCredentialAccount.id },
        data: { password: hashedPassword },
      });
    } else {
      await prisma.account.create({
        data: {
          accountId: parsed.data.id,
          providerId: "credential",
          userId: parsed.data.id,
          password: hashedPassword,
        },
      });
    }

    revalidatePath("/settings/users");
  }

  async function togglePermission(formData: FormData) {
    "use server";
    const { user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const parsed = togglePermissionSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      permission: String(formData.get("permission") ?? ""),
      enabled: String(formData.get("enabled") ?? "false"),
    });
    if (!parsed.success) return;
    if (!EXTRA_PERMISSIONS.includes(parsed.data.permission as (typeof EXTRA_PERMISSIONS)[number])) {
      return;
    }

    if (parsed.data.enabled === "true") {
      await prisma.userPermission.upsert({
        where: {
          userId_permission: {
            userId: parsed.data.id,
            permission: parsed.data.permission,
          },
        },
        create: {
          userId: parsed.data.id,
          permission: parsed.data.permission,
        },
        update: {},
      });
    } else {
      await prisma.userPermission.deleteMany({
        where: {
          userId: parsed.data.id,
          permission: parsed.data.permission,
        },
      });
    }

    revalidatePath("/settings/users");
  }

  async function applyPermissionPreset(formData: FormData) {
    "use server";
    const { user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const parsed = applyPresetSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      preset: String(formData.get("preset") ?? "standard"),
    });
    if (!parsed.success) return;

    const target = await prisma.user.findUnique({
      where: { id: parsed.data.id },
      select: { role: true },
    });
    if (!target || (target.role !== "TECHNICIAN_INTERNAL" && target.role !== "OPS")) {
      return;
    }

    const nextPermissions =
      parsed.data.preset === "extended_ops" ? EXTENDED_OPS_PRESET : [];

    await prisma.userPermission.deleteMany({ where: { userId: parsed.data.id } });

    for (const permission of nextPermissions) {
      await prisma.userPermission.create({
        data: { userId: parsed.data.id, permission },
      });
    }

    revalidatePath("/settings/users");
  }

  const usersBase = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      _count: {
        select: {
          jobsCreated: true,
          jobsAssigned: true,
          payoutsMarked: true,
          auditLogs: true,
          clientNotes: true,
        },
      },
    },
  });

  let permissionMap = new Map<string, Array<{ permission: string }>>();
  try {
    const permissionRows = await prisma.$queryRaw<Array<{ userId: string; permission: string }>>`
      SELECT userId, permission FROM "UserPermission"
    `;
    permissionMap = permissionRows.reduce((acc, row) => {
      if (!acc.has(row.userId)) acc.set(row.userId, []);
      acc.get(row.userId)?.push({ permission: row.permission });
      return acc;
    }, new Map<string, Array<{ permission: string }>>());
  } catch {
    permissionMap = new Map();
  }

  const usersWithPermissions = usersBase.map((user) => ({
    ...user,
    permissionGrants: permissionMap.get(user.id) ?? [],
  }));

  const users = Array.from(
    new Map(
      usersWithPermissions.map((user) => {
        const key = `${user.email.trim().toLowerCase()}::${user.role}`;
        return [key, user] as const;
      }),
    ).values(),
  );
  const controlClass =
    "rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";

  return (
    <div className="space-y-4">
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">User Access Brief</p>
          <p className="mt-1 text-sm text-[var(--ink)] [overflow-wrap:anywhere]">
            Manage user lifecycle, role posture, and extended permissions from one workspace.
          </p>
        </div>
      </div>

      <form action={createUser} className="panel-shadow space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Create user</p>
        <div className="grid gap-2 lg:hidden">
          <input required name="name" placeholder="Name" className={controlClass} />
          <input required type="email" name="email" placeholder="Email" className={controlClass} />
          <div className="grid grid-cols-2 gap-2">
            <input required name="password" type="password" placeholder="Password" className={`min-w-0 ${controlClass}`} />
            <select id="create-user-role" name="role" defaultValue={Role.OPS} className="min-w-0 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20">
              {safeRoleChoices.map((role) => (
                <option key={`mobile-${role}`} value={role}>{prettyRole(role)}</option>
              ))}
            </select>
          </div>
          <details className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <summary className="list-none text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">Optional details</summary>
            <input name="phone" placeholder="Phone" className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20" />
          </details>
        </div>

        <div className="hidden gap-2 lg:grid lg:grid-cols-4">
          <input required name="name" placeholder="Name" className={controlClass} />
          <input required type="email" name="email" placeholder="Email" className={controlClass} />
          <input name="phone" placeholder="Phone (optional)" className={controlClass} />
          <input required name="password" type="password" placeholder="Password" className={controlClass} />
        </div>

        <div className="hidden rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3 lg:block">
          <label htmlFor="create-user-role" className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            Role
          </label>
          <div className="grid gap-2 lg:grid-cols-4">
            {safeRoleChoices.map((role) => (
              <label key={role} className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
                <input type="radio" name="role" value={role} defaultChecked={role === Role.OPS} />
                <span>{prettyRole(role)}</span>
              </label>
            ))}
          </div>
        </div>
        <SubmitActionButton
          idleLabel="Create User"
          pendingLabel="Creating..."
          className="btn-premium w-full rounded-lg px-3 py-2 text-white md:w-auto"
        />
      </form>

      <div className="space-y-2">
        <ProgressiveList initialCount={4} step={4}>
          {users.map((u) => {
            const hasLinkedRecords =
              u._count.jobsCreated > 0 ||
              u._count.jobsAssigned > 0 ||
              u._count.payoutsMarked > 0 ||
              u._count.auditLogs > 0 ||
              u._count.clientNotes > 0;

            return (
            <details key={u.id} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <summary className="list-none cursor-pointer">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.name}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{u.email}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{u.phone || "No phone"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[var(--line)] bg-white px-2 py-1 text-xs">{roleLabel(u.role)}</span>
                  <span className={`rounded-full px-2 py-1 text-xs ${u.isActive ? "bg-[#D4AF37]/20 text-[#D4AF37]" : "bg-slate-200 text-slate-700"}`}>
                    {u.isActive ? "Account: Active" : "Account: Inactive"}
                  </span>
                  {hasLinkedRecords ? (
                    <span className="rounded-full bg-slate-300 px-2 py-1 text-xs text-slate-800">Has history</span>
                  ) : null}
                  <span className="text-[11px] text-[var(--ink-muted)] sm:hidden">Tap to expand</span>
                </div>
              </div>
            </summary>

            <UserDetailsForm id={u.id} name={u.name} email={u.email} phone={u.phone} action={updateDetails} />

            <div className="grid gap-2">
              <form action={updateRole} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <input type="hidden" name="id" value={u.id} />
                {safeRoleChoices.map((role) => (
                    <RoleActionButton
                      key={role}
                      role={role}
                      currentRole={u.role}
                      label={roleLabel(role)}
                    />
                  ))}
              </form>
              <form action={updatePassword} className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="id" value={u.id} />
                <input
                  required
                  name="password"
                  type="password"
                  minLength={8}
                  placeholder="Set new password (min 8 chars)"
                  className="min-w-0 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
                />
                <SubmitActionButton
                  idleLabel="Update Password"
                  pendingLabel="Updating..."
                  className="btn-premium w-full rounded-md px-3 py-2 text-sm text-white sm:w-auto"
                />
              </form>
              <section className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                {u.role === "TECHNICIAN_INTERNAL" || u.role === "OPS" ? (
                  <>
                    <input id={`permissions-toggle-${u.id}`} type="checkbox" className="peer sr-only" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Extended permissions</p>
                      <span className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
                        Extended access: {u.permissionGrants.length}/{EXTRA_PERMISSIONS.length} enabled
                      </span>
                      <label htmlFor={`permissions-toggle-${u.id}`} className="btn-premium-secondary cursor-pointer rounded-md px-2.5 py-1 text-xs">
                        Manage
                      </label>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                      Base role controls default access. Extended permissions add controlled exceptions.
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <form action={applyPermissionPreset}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="preset" value="standard" />
                        <button className="btn-premium-secondary w-full rounded-md px-2.5 py-1.5 text-xs">
                          Apply Standard
                        </button>
                      </form>
                      <form action={applyPermissionPreset}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="preset" value="extended_ops" />
                        <button className="btn-premium w-full rounded-md px-2.5 py-1.5 text-xs text-white">
                          Apply Extended Ops
                        </button>
                      </form>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {u.permissionGrants.length > 0 ? (
                        u.permissionGrants.map((grant) => (
                          <span key={`${u.id}-chip-${grant.permission}`} className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-[11px] text-[#D4AF37]">
                            {grant.permission.replaceAll("_", " ")}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--ink-muted)]">No extended permissions enabled.</span>
                      )}
                    </div>
                    <div className="mt-3 hidden gap-2 peer-checked:grid sm:grid-cols-2">
                      {EXTRA_PERMISSIONS.map((permission) => {
                        const enabled = u.permissionGrants.some((grant) => grant.permission === permission);
                        return (
                          <form key={`${u.id}-${permission}`} action={togglePermission} className="rounded-md border border-[var(--line)] bg-white p-2">
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="permission" value={permission} />
                            <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
                            <button className="w-full text-left text-xs">
                              <p className="font-semibold text-[var(--ink)]">{permission.replaceAll("_", " ")}</p>
                              <p className={`mt-1 ${enabled ? "text-[#D4AF37]" : "text-[var(--ink-muted)]"}`}>{enabled ? "Enabled" : "Disabled"}</p>
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Extended permissions</p>
                    <span className="text-xs text-[var(--ink-muted)]">Not applicable for this role</span>
                  </div>
                )}
              </section>
              {u.isActive ? (
                <div className="flex flex-wrap gap-2">
                  {u.role !== "ADMIN" ? (
                    <form action={deactivate} className="sm:w-fit">
                      <input type="hidden" name="id" value={u.id} />
                      <SubmitActionButton
                        idleLabel="Deactivate"
                        pendingLabel="Deactivating..."
                        className="btn-premium-danger w-full rounded-md px-3 py-2 text-sm sm:w-auto"
                      />
                    </form>
                  ) : null}
                  <form action={deleteUser} className="sm:w-fit">
                    {u.role !== "ADMIN" ? (
                      <>
                        <input type="hidden" name="id" value={u.id} />
                        <SubmitActionButton
                          idleLabel={hasLinkedRecords ? "Archive" : "Delete"}
                          pendingLabel={hasLinkedRecords ? "Archiving..." : "Deleting..."}
                          className="btn-premium-secondary w-full rounded-md px-3 py-2 text-sm sm:w-auto"
                        />
                      </>
                    ) : null}
                  </form>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-500">Inactive</span>
                  <form action={reactivate} className="sm:w-fit">
                    <input type="hidden" name="id" value={u.id} />
                    <SubmitActionButton
                      idleLabel="Activate"
                      pendingLabel="Activating..."
                      className="btn-premium w-full rounded-md px-3 py-2 text-sm text-white sm:w-auto"
                    />
                  </form>
                  {u.id !== session.user.id && u.role !== "ADMIN" ? (
                    <form action={deleteUser} className="sm:w-fit">
                      <input type="hidden" name="id" value={u.id} />
                      <SubmitActionButton
                        idleLabel={hasLinkedRecords ? "Archive" : "Delete"}
                        pendingLabel={hasLinkedRecords ? "Archiving..." : "Deleting..."}
                        className="btn-premium-secondary w-full rounded-md px-3 py-2 text-sm sm:w-auto"
                      />
                    </form>
                  ) : null}
                </div>
              )}
            </div>
            </details>
            );
          })}
        </ProgressiveList>
      </div>
    </div>
  );
}
