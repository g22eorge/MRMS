import { hashPassword } from "better-auth/crypto";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
});

const updateRoleSchema = z.object({
  id: z.string().min(1),
  role: z.nativeEnum(Role),
});

export default async function UsersPage() {
  const { user } = await getCurrentUserRole();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  async function createUser(formData: FormData) {
    "use server";
    const parsed = createUserSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "INTAKE"),
    });
    if (!parsed.success) return;

    const newUser = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
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
  }

  async function updateRole(formData: FormData) {
    "use server";
    const parsed = updateRoleSchema.safeParse({
      id: String(formData.get("id") ?? ""),
      role: String(formData.get("role") ?? ""),
    });
    if (!parsed.success) return;
    await prisma.user.update({ where: { id: parsed.data.id }, data: { role: parsed.data.role } });
  }

  async function deactivate(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    await prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">User Management</h1>
      <form action={createUser} className="panel-shadow space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Create user</p>
        <div className="grid gap-2 md:grid-cols-4">
          <input required name="name" placeholder="Name" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <input required type="email" name="email" placeholder="Email" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <input required name="password" type="password" placeholder="Password" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2" />
          <select name="role" className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <option value="ADMIN">ADMIN</option>
            <option value="INTAKE">INTAKE</option>
            <option value="TECHNICIAN_INTERNAL">TECHNICIAN_INTERNAL</option>
            <option value="TECHNICIAN_EXTERNAL">TECHNICIAN_EXTERNAL</option>
            <option value="OPS">OPS</option>
            <option value="ACCOUNTS">ACCOUNTS</option>
          </select>
        </div>
        <button className="w-full rounded-md bg-[var(--brand)] px-3 py-2 text-white md:w-auto">Create User</button>
      </form>

      <div className="space-y-2">
        {users.map((u: { id: string; name: string; email: string; role: Role; isActive: boolean }) => (
          <div key={u.id} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {u.name} <span className="text-sm text-slate-500">({u.email})</span>
              </p>
              <span className="rounded-full bg-[var(--panel-strong)] px-2 py-1 text-xs">{u.role}</span>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <form action={updateRole} className="grid gap-2 sm:flex sm:gap-2">
                <input type="hidden" name="id" value={u.id} />
                <select name="role" defaultValue={u.role} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-2 text-sm">
                  <option value="ADMIN">ADMIN</option>
                  <option value="INTAKE">INTAKE</option>
                  <option value="TECHNICIAN_INTERNAL">TECHNICIAN_INTERNAL</option>
                  <option value="TECHNICIAN_EXTERNAL">TECHNICIAN_EXTERNAL</option>
                  <option value="OPS">OPS</option>
                  <option value="ACCOUNTS">ACCOUNTS</option>
                </select>
                <button className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">Update Role</button>
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
