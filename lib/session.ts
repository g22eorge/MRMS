import { Role } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(allowed: Role[]) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true },
  });

  if (!user?.isActive || !allowed.includes(user.role)) {
    redirect("/dashboard");
  }

  return { session, role: user.role };
}

export async function getCurrentUserRole() {
  const session = await requireSession();
  const baseUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true, name: true, email: true },
  });

  let phone: string | null = null;
  if (baseUser) {
    try {
      const phoneRows = await prisma.$queryRaw<Array<{ phone: string | null }>>`
        SELECT phone FROM "User" WHERE id = ${session.user.id} LIMIT 1
      `;
      phone = phoneRows[0]?.phone ?? null;
    } catch {
      phone = null;
    }
  }

  const user = baseUser ? { ...baseUser, phone } : null;

  if (!user?.isActive) {
    redirect("/login");
  }

  return { session, user };
}
