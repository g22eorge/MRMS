"use server";

import { prisma } from "@/lib/prisma";
import { OrgPlan, OrgModule } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { setOrgAtSenderId } from "@/lib/org-whatsapp-config";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { revalidatePlatformHome, revalidatePlatformOrg, revalidatePlatformOrgAndHome } from "@/lib/platform/revalidate";

export type PlatformResetState = { error?: string; success?: string };

/**
 * Reset an organization's admin (or any user's) password from the platform
 * console — for when an org admin is locked out. Sets a new credential and
 * signs the target out everywhere. Platform-admin gated.
 */
export async function resetOrgAdminPasswordAction(
  _state: PlatformResetState,
  formData: FormData,
): Promise<PlatformResetState> {
  const admin = await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (password !== confirm) return { error: "Passwords do not match" };
  if (!userId) return { error: "No user specified" };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, orgId: true, email: true } });
  if (!target) return { error: "User not found" };

  const hashed = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashed },
    });
    if (updated.count === 0) {
      await tx.account.create({
        data: { accountId: userId, providerId: "credential", userId, password: hashed },
      });
    }
    // Force re-login everywhere after a platform reset.
    await tx.session.deleteMany({ where: { userId } });
  });

  await writeSystemAuditEvent({
    orgId: target.orgId,
    actorUserId: admin.id,
    entityType: "User",
    entityId: userId,
    action: "ORG_ADMIN_PASSWORD_RESET",
    summary: `Platform admin reset password for ${target.email} and signed out all sessions`,
  });

  if (target.orgId) revalidatePlatformOrg(target.orgId);
  return { success: `Password reset — ${target.email} signed out everywhere` };
}

export async function setPlanAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const plan = formData.get("plan") as OrgPlan;
  if (!orgId || !["STARTER", "STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"].includes(plan)) return;
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan, billingStatus: plan === "STARTER" ? "TRIALING" : "ACTIVE" },
  });
  revalidatePlatformHome();
}

export async function toggleOrgActive(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const isActive = formData.get("isActive") === "true";
  if (!orgId) return;
  await prisma.organization.update({ where: { id: orgId }, data: { isActive: !isActive } });
  revalidatePlatformHome();
}

export async function extendTrialAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const days = parseInt(formData.get("days") as string, 10);
  if (!orgId || isNaN(days) || days <= 0) return;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { trialEndsAt: true, billingStatus: true },
  });
  if (!org) return;

  const base = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
  const newDate = new Date(base);
  newDate.setDate(newDate.getDate() + days);

  await prisma.organization.update({
    where: { id: orgId },
    data: { trialEndsAt: newDate, billingStatus: "TRIALING" },
  });
  revalidatePlatformHome();
}

export async function runCommercialSeedAction() {
  await requirePlatformAdmin();
  try {
    const { seedCommercialData } = await import("@/prisma/seed-commercial");
    await seedCommercialData();
  } catch (err) {
    console.error("[seed:commercial]", err);
  }
  revalidatePlatformHome();
}

export async function setOrgSmsSenderAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const raw = (formData.get("senderId") as string | null)?.trim() ?? "";
  if (!orgId) return;
  const senderId = raw === "" ? null : raw;
  if (senderId && (senderId.length > 11 || !/^[A-Za-z0-9]+$/.test(senderId))) return;
  await setOrgAtSenderId(orgId, senderId);
  revalidatePlatformOrg(orgId);
}

export async function setOrgAiModelAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const model = ((formData.get("aiModel") as string | null) ?? "").trim() || null;
  if (!orgId) return;
  await prisma.organization.update({ where: { id: orgId }, data: { aiModel: model } });
  revalidatePlatformOrg(orgId);
}

export async function toggleOrgModuleAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const orgModule = formData.get("module") as string;
  const currentlyEnabled = formData.get("currentlyEnabled") === "true";
  if (!orgId || !orgModule) return;
  try {
    if (currentlyEnabled) {
      await prisma.orgModuleGrant.deleteMany({ where: { orgId, module: orgModule as OrgModule } });
    } else {
      await prisma.orgModuleGrant.upsert({
        where: { orgId_module: { orgId, module: orgModule as OrgModule } },
        create: { orgId, module: orgModule as OrgModule },
        update: {},
      });
    }
  } catch { /* table may not exist yet */ }
  revalidatePlatformOrg(orgId);
}

export async function setBillingStatusAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const status = formData.get("status") as string;
  if (!orgId || !["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"].includes(status)) return;
  await prisma.organization.update({
    where: { id: orgId },
    data: { billingStatus: status as never },
  });
  revalidatePlatformOrgAndHome(orgId);
}

export async function updateOrgDetailsAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  if (!orgId) return;
  const data: Record<string, unknown> = {};
  for (const key of ["name", "tagline", "website", "phone", "email", "address"]) {
    const val = formData.get(key) as string | null;
    if (val !== null) data[key] = val || null;
  }
  const enableRepair = formData.get("enableRepairModule");
  if (enableRepair !== null) data.enableRepairModule = enableRepair === "true";
  await prisma.organization.update({ where: { id: orgId }, data: data as never });
  revalidatePlatformOrg(orgId);
}
