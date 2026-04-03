import { hashPassword } from "better-auth/crypto";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

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
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
});

const roleChoices: Role[] = [
  Role.ADMIN,
  Role.OPS,
  Role.TECHNICIAN_INTERNAL,
  Role.TECHNICIAN_EXTERNAL,
];

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
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
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

  async function updateDetails(formData: FormData) {
    "use server";
    const { user: currentUser } = await getCurrentUserRole();
    if (currentUser.role !== "ADMIN") return;

    const parsed = updateDetailsSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    });
    if (!parsed.success) return;

    await prisma.user.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email.trim().toLowerCase(),
        phone: parsed.data.phone?.trim() || null,
      },
    });

    revalidatePath("/settings/users");
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
        <div className="grid gap-2 md:grid-cols-4">
          <input required name="name" placeholder="Name" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <input required type="email" name="email" placeholder="Email" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <input name="phone" placeholder="Phone (optional)" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <input required name="password" type="password" placeholder="Password" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
        </div>
        <fieldset className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
          <legend className="px-1 text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Role</legend>
          <div className="grid gap-2 md:grid-cols-4">
            {roleChoices.map((role) => (
              <label key={role} className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
                <input type="radio" name="role" value={role} defaultChecked={role === Role.OPS} />
                <span>{role.replaceAll("_", " ")}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="w-full rounded-md bg-[var(--brand)] px-3 py-2 text-white md:w-auto">Create User</button>
      </form>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {u.name} <span className="text-sm text-slate-500">({u.email})</span>
              </p>
              <span className="rounded-full bg-[var(--panel-strong)] px-2 py-1 text-xs">{u.role.replaceAll("_", " ")}</span>
            </div>

            <form action={updateDetails} className="mb-3 grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3 md:grid-cols-4">
              <input type="hidden" name="id" value={u.id} />
              <input
                required
                name="name"
                defaultValue={u.name}
                placeholder="Full name"
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
              <input
                required
                type="email"
                name="email"
                defaultValue={u.email}
                placeholder="Email"
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
              <input
                name="phone"
                defaultValue={u.phone ?? ""}
                placeholder="Phone"
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
              <button className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">Save Profile</button>
            </form>

            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
              <form action={updateRole} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={u.id} />
                {roleChoices.map((role) => (
                  <button
                    key={role}
                    name="role"
                    value={role}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      u.role === role
                        ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--ink)]"
                    }`}
                  >
                    {role.replaceAll("_", " ")}
                  </button>
                ))}
              </form>
              {u.isActive ? (
                <form action={deactivate}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="w-full rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:w-auto">
                    Deactivate
                  </button>
                </form>
              ) : (
                <span className="text-sm text-slate-500">Inactive</span>
              )}
            </div>
          </div>
        ))}
        </div>
    </div>
  );
}
