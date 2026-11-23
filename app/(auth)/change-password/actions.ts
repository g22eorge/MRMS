"use server";

import { hashPassword, verifyPassword } from "better-auth/crypto";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/**
 * Replace a password an admin set.
 *
 * Deliberately not built on requireOrgSession: that is what redirects a flagged
 * user here, so using it would bounce this action against itself.
 */
export async function changeIssuedPasswordAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const userId = session.user.id;

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const fail = (message: string): never => redirect(`/change-password?error=${encodeURIComponent(message)}`);

  if (!current || !next || !confirm) fail("Fill in every field.");
  if (next.length < 8) fail("Your new password needs to be at least 8 characters.");
  if (next !== confirm) fail("The two new passwords don't match.");
  if (next === current) fail("Choose a password different from the one you were given.");

  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true, password: true },
  });
  if (!account?.password) fail("This account has no password to change. Ask an administrator.");

  const valid = await verifyPassword({ hash: account!.password!, password: current }).catch(() => false);
  if (!valid) fail("That current password isn't right.");

  const hashed = await hashPassword(next);
  await prisma.$transaction([
    prisma.account.update({ where: { id: account!.id }, data: { password: hashed } }),
    prisma.user.update({ where: { id: userId }, data: { mustChangePassword: false } }),
    // Every other session ends; this one stays, so the user is not thrown back
    // to the sign-in page the moment they finish.
    prisma.session.deleteMany({ where: { userId, id: { not: session.session.id } } }),
  ]);

  redirect("/dashboard");
}
