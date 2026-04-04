import { hashPassword } from "better-auth/crypto";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ProgressiveList } from "@/components/mobile/ProgressiveList";
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

type UserDetailsState = {
  error?: string;
  success?: string;
};

const roleChoices: Role[] = [
  Role.ADMIN,
  Role.OPS,
  Role.TECHNICIAN_INTERNAL,
  Role.TECHNICIAN_EXTERNAL,
];

const roleDisplay: Record<Role, string> = {
  ADMIN: "Admin",
  OPS: "Ops",
  TECHNICIAN_INTERNAL: "Internal Tech",
  TECHNICIAN_EXTERNAL: "External Tech",
};

export default async function UsersPage() {
  const { user } = await getCurrentUserRole();
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
    await prisma.user.update({ where: { id }, data: { isActive: false } });

    revalidatePath("/settings/users");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
    },
  });

  return (
    <div className="space-y-4">
      <form action={createUser} className="panel-shadow space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Create user</p>
        <div className="grid gap-2 md:hidden">
          <input required name="name" placeholder="Name" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <input required type="email" name="email" placeholder="Email" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <input required name="password" type="password" placeholder="Password" className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
            <select id="create-user-role" name="role" defaultValue={Role.OPS} className="min-w-0 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
              {roleChoices.map((role) => (
                <option key={`mobile-${role}`} value={role}>{role.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
          <details className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <summary className="list-none text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">Optional details</summary>
            <input name="phone" placeholder="Phone" className="mt-2 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2" />
          </details>
        </div>

        <div className="hidden gap-2 md:grid md:grid-cols-4">
          <input required name="name" placeholder="Name" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <input required type="email" name="email" placeholder="Email" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <input name="phone" placeholder="Phone (optional)" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <input required name="password" type="password" placeholder="Password" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
        </div>

        <div className="hidden rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3 md:block">
          <label htmlFor="create-user-role" className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            Role
          </label>
          <div className="grid gap-2 md:grid-cols-4">
            {roleChoices.map((role) => (
              <label key={role} className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
                <input type="radio" name="role" value={role} defaultChecked={role === Role.OPS} />
                <span>{role.replaceAll("_", " ")}</span>
              </label>
            ))}
          </div>
        </div>
        <SubmitActionButton
          idleLabel="Create User"
          pendingLabel="Creating..."
          className="btn-premium w-full rounded-md px-3 py-2 text-white md:w-auto"
        />
      </form>

      <div className="space-y-2">
        <ProgressiveList initialCount={4} step={4}>
          {users.map((u) => (
            <details key={u.id} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" open>
            <summary className="list-none sm:pointer-events-none">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.name}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{u.email}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{u.phone || "No phone"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[var(--line)] bg-white px-2 py-1 text-xs">{roleDisplay[u.role]}</span>
                  <span className={`rounded-full px-2 py-1 text-xs ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-[11px] text-[var(--ink-muted)] sm:hidden">Tap to fold</span>
                </div>
              </div>
            </summary>

            <UserDetailsForm id={u.id} name={u.name} email={u.email} phone={u.phone} action={updateDetails} />

            <div className="grid gap-2">
              <form action={updateRole} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <input type="hidden" name="id" value={u.id} />
                {roleChoices.map((role) => (
                  <RoleActionButton
                    key={role}
                    role={role}
                    currentRole={u.role}
                    label={roleDisplay[role]}
                  />
                ))}
              </form>
              {u.isActive ? (
                <form action={deactivate} className="sm:w-fit">
                  <input type="hidden" name="id" value={u.id} />
                  <SubmitActionButton
                    idleLabel="Deactivate"
                    pendingLabel="Deactivating..."
                    className="btn-premium-danger w-full rounded-md px-3 py-2 text-sm sm:w-auto"
                  />
                </form>
              ) : (
                <span className="text-sm text-slate-500">Inactive</span>
              )}
            </div>
            </details>
          ))}
        </ProgressiveList>
      </div>
    </div>
  );
}
