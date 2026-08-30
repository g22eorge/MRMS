"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { OrgPlan, OrgModule } from "@prisma/client";
import { orgModulesTag } from "@/lib/module-access";
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
  const admin = await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const plan = formData.get("plan") as OrgPlan;
  if (!orgId || !["STARTER", "STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"].includes(plan)) return;
  // Read first: an audit entry that cannot say what the plan WAS only records
  // that someone touched it, which is the half that does not help later.
  const before = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, plan: true, billingStatus: true },
  });
  const billingStatus = plan === "STARTER" ? "TRIALING" : "ACTIVE";
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan, billingStatus },
  });
  await writeSystemAuditEvent({
    orgId,
    actorUserId: admin.id,
    entityType: "Organization",
    entityId: orgId,
    action: "ORG_PLAN_CHANGED",
    summary: `Plan set to ${plan} (was ${before?.plan ?? "unknown"}) for ${before?.name ?? orgId}`,
    before: before ? { plan: before.plan, billingStatus: before.billingStatus } : null,
    after: { plan, billingStatus },
  });
  revalidatePlatformHome();
}

export async function toggleOrgActive(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const isActive = formData.get("isActive") === "true";
  if (!orgId) return;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  await prisma.organization.update({ where: { id: orgId }, data: { isActive: !isActive } });
  // Cutting off a customer's access is the platform action with the most
  // immediate effect on them; it should never be the one nobody can date.
  await writeSystemAuditEvent({
    orgId,
    actorUserId: admin.id,
    entityType: "Organization",
    entityId: orgId,
    action: !isActive ? "ORG_REACTIVATED" : "ORG_DEACTIVATED",
    summary: `${!isActive ? "Reactivated" : "Deactivated"} ${org?.name ?? orgId}`,
    before: { isActive },
    after: { isActive: !isActive },
  });
  revalidatePlatformHome();
}

export async function extendTrialAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
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
  // Free time given away is a commercial decision, so it gets a record with a
  // number in it rather than a note that a trial moved.
  await writeSystemAuditEvent({
    orgId,
    actorUserId: admin.id,
    entityType: "Organization",
    entityId: orgId,
    action: "ORG_TRIAL_EXTENDED",
    summary: `Trial extended by ${days} day${days === 1 ? "" : "s"} to ${newDate.toISOString().slice(0, 10)}`,
    before: { trialEndsAt: org.trialEndsAt, billingStatus: org.billingStatus },
    after: { trialEndsAt: newDate, billingStatus: "TRIALING" },
  });
  revalidatePlatformHome();
}

export async function runCommercialSeedAction() {
  const admin = await requirePlatformAdmin();
  let ok = true;
  let message: string | null = null;
  try {
    const { seedCommercialData } = await import("@/prisma/seed-commercial");
    await seedCommercialData();
  } catch (err) {
    ok = false;
    message = err instanceof Error ? err.message : String(err);
    console.error("[seed:commercial]", err);
  }
  // Writes demo data across the platform, so it is recorded either way — a
  // failed run that left rows behind is exactly the case worth being able to date.
  await writeSystemAuditEvent({
    actorUserId: admin.id,
    entityType: "Platform",
    entityId: "commercial-seed",
    action: "PLATFORM_COMMERCIAL_SEED_RUN",
    summary: ok ? "Commercial demo seed ran" : `Commercial demo seed failed: ${message}`,
    after: { ok, error: message },
  });
  revalidatePlatformHome();
}

export async function setOrgSmsSenderAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const raw = (formData.get("senderId") as string | null)?.trim() ?? "";
  if (!orgId) return;
  const senderId = raw === "" ? null : raw;
  if (senderId && (senderId.length > 11 || !/^[A-Za-z0-9]+$/.test(senderId))) {
    // Africa's Talking caps alphanumeric sender IDs at 11 characters, letters and
    // digits only. Silently ignoring a bad one looked like the save had worked.
    redirect(`/platform/orgs/${orgId}?error=${encodeURIComponent("A sender ID must be 11 characters or fewer, letters and digits only.")}`);
  }
  const beforeSender = await prisma.organization
    .findUnique({ where: { id: orgId }, select: { name: true } })
    .catch(() => null);
  await setOrgAtSenderId(orgId, senderId);
  // The sender ID is what a customer's clients see on every SMS; a silent change
  // to it is a support ticket nobody can trace.
  await writeSystemAuditEvent({
    orgId,
    actorUserId: admin.id,
    entityType: "Organization",
    entityId: orgId,
    action: "ORG_SMS_SENDER_CHANGED",
    summary: `SMS sender ID for ${beforeSender?.name ?? orgId} set to ${senderId ?? "(cleared)"}`,
    after: { senderId },
  });
  revalidatePlatformOrg(orgId);
}

export async function setOrgAiModelAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const model = ((formData.get("aiModel") as string | null) ?? "").trim() || null;
  if (!orgId) return;
  const before = await prisma.organization
    .findUnique({ where: { id: orgId }, select: { name: true, aiModel: true } })
    .catch(() => null);
  await prisma.organization.update({ where: { id: orgId }, data: { aiModel: model } });
  await writeSystemAuditEvent({
    orgId,
    actorUserId: admin.id,
    entityType: "Organization",
    entityId: orgId,
    action: "ORG_AI_MODEL_CHANGED",
    summary: `AI model for ${before?.name ?? orgId} set to ${model ?? "(default)"}`,
    before: { aiModel: before?.aiModel ?? null },
    after: { aiModel: model },
  });
  revalidatePlatformOrg(orgId);
}

export async function toggleOrgModuleAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
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
  // Modules decide which features a customer sees. Turning one off looks to
  // them like the product broke, so the record needs to name which one.
  await writeSystemAuditEvent({
    orgId,
    actorUserId: admin.id,
    entityType: "Organization",
    entityId: orgId,
    action: currentlyEnabled ? "ORG_MODULE_DISABLED" : "ORG_MODULE_ENABLED",
    summary: `Module ${orgModule} ${currentlyEnabled ? "disabled" : "enabled"}`,
    before: { module: orgModule, enabled: currentlyEnabled },
    after: { module: orgModule, enabled: !currentlyEnabled },
  });
  revalidateTag(orgModulesTag(orgId), "max");
  revalidatePlatformOrg(orgId);
}

export async function setBillingStatusAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const status = formData.get("status") as string;
  if (!orgId || !["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"].includes(status)) return;
  const before = await prisma.organization
    .findUnique({ where: { id: orgId }, select: { name: true, billingStatus: true } })
    .catch(() => null);
  await prisma.organization.update({
    where: { id: orgId },
    data: { billingStatus: status as never },
  });
  // Marking an organisation ACTIVE by hand is indistinguishable from a payment
  // that worked unless someone wrote down that a person did it. That mattered
  // the moment the Pesapal webhook was found to be failing silently: without
  // this line, a manual repair and a real payment leave the same trace.
  await writeSystemAuditEvent({
    orgId,
    actorUserId: admin.id,
    entityType: "Organization",
    entityId: orgId,
    action: "ORG_BILLING_STATUS_CHANGED",
    summary: `Billing status for ${before?.name ?? orgId} set to ${status} (was ${before?.billingStatus ?? "unknown"}) by hand`,
    before: { billingStatus: before?.billingStatus ?? null },
    after: { billingStatus: status },
  });
  revalidatePlatformOrgAndHome(orgId);
}

export async function updateOrgDetailsAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  if (!orgId) return;
  const data: Record<string, unknown> = {};
  for (const key of ["name", "tagline", "website", "phone", "email", "address"]) {
    const val = formData.get(key) as string | null;
    if (val !== null) data[key] = val || null;
  }
  const enableRepair = formData.get("enableRepairModule");
  if (enableRepair !== null) data.enableRepairModule = enableRepair === "true";
  // Only `name` is selected because only `name` exists. This action writes
  // tagline, website, phone, email, address and enableRepairModule too, none of
  // which are fields on Organization — `data as never` casts the check away, so
  // it would throw at runtime. Nothing calls it: there is no caller anywhere in
  // the app. Left in place rather than deleted on my own judgement, but it is
  // dead and it is broken, and the audit entry below records whichever keys a
  // caller sent so a future invocation is at least legible.
  const before = await prisma.organization
    .findUnique({ where: { id: orgId }, select: { name: true } })
    .catch(() => null);
  await prisma.organization.update({ where: { id: orgId }, data: data as never });
  await writeSystemAuditEvent({
    orgId,
    actorUserId: admin.id,
    entityType: "Organization",
    entityId: orgId,
    action: "ORG_DETAILS_UPDATED",
    summary: `Details updated for ${before?.name ?? orgId}: ${Object.keys(data).join(", ")}`,
    before,
    after: data,
  });
  revalidatePlatformOrg(orgId);
}
