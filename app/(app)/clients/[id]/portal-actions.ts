"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { hashPortalPassword } from "@/lib/portal-auth";
import type { PortalRole } from "@prisma/client";

const ROLES: PortalRole[] = ["ORG_ADMIN", "IT_OFFICER", "MEMBER"];

function canManagePortal(role: string) {
  return ["ADMIN", "OPS"].includes(role);
}

/** Staff provisions a corporate-client portal login. */
export async function createPortalUserAction(formData: FormData): Promise<void> {
  const { user, orgId, org } = await requireOrgSession();
  if (!canManagePortal(user.role)) return;
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const clientId = String(formData.get("clientId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const position = String(formData.get("position") ?? "").trim() || null;
  const roleRaw = String(formData.get("role") ?? "IT_OFFICER").trim().toUpperCase();
  const role = (ROLES.includes(roleRaw as PortalRole) ? roleRaw : "IT_OFFICER") as PortalRole;
  const password = String(formData.get("password") ?? "");

  if (!clientId || !name || !email || password.length < 8) return;

  // Client must belong to this org.
  const client = await prisma.client.findFirst({ where: { id: clientId, orgId }, select: { id: true } });
  if (!client) return;

  // Email must be unique within the org's portal.
  const existing = await prisma.portalUser.findFirst({ where: { orgId, email }, select: { id: true } });
  if (existing) return;

  const created = await prisma.portalUser.create({
    data: {
      orgId,
      clientId,
      name,
      email,
      phone,
      position,
      role,
      passwordHash: await hashPortalPassword(password),
      createdById: user.id,
    },
    select: { id: true },
  });

  await writeSystemAuditEvent({
    orgId,
    actorUserId: user.id,
    entityType: "PortalUser",
    entityId: created.id,
    action: "PORTAL_USER_CREATED",
    summary: `Portal access created for ${email} (${role})`,
  });

  revalidatePath(`/clients/${clientId}`);
}

/** Grant a portal login access to an additional client account (multi-account). */
export async function linkPortalUserToClientAction(formData: FormData): Promise<void> {
  const { user, orgId, org } = await requireOrgSession();
  if (!canManagePortal(user.role)) return;
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const portalUserId = String(formData.get("portalUserId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim(); // account to grant
  const fromClientId = String(formData.get("fromClientId") ?? "").trim(); // page to revalidate
  if (!portalUserId || !clientId) return;

  // Portal user + target client must both belong to this org.
  const [pu, client] = await Promise.all([
    prisma.portalUser.findFirst({ where: { id: portalUserId, orgId }, select: { id: true, clientId: true } }),
    prisma.client.findFirst({ where: { id: clientId, orgId }, select: { id: true } }),
  ]);
  if (!pu || !client) return;
  if (pu.clientId === clientId) return; // already the primary account

  await prisma.portalUserClient.upsert({
    where: { portalUserId_clientId: { portalUserId, clientId } },
    create: { portalUserId, clientId, orgId },
    update: {},
  });

  await writeSystemAuditEvent({
    orgId, actorUserId: user.id,
    entityType: "PortalUser", entityId: portalUserId,
    action: "PORTAL_USER_ACCOUNT_LINKED",
    summary: `Granted portal login access to an additional client account`,
  }).catch(() => {});

  if (fromClientId) revalidatePath(`/clients/${fromClientId}`);
}

/** Remove an additional client account from a portal login. */
export async function unlinkPortalUserFromClientAction(formData: FormData): Promise<void> {
  const { user, orgId, org } = await requireOrgSession();
  if (!canManagePortal(user.role)) return;
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const portalUserId = String(formData.get("portalUserId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const fromClientId = String(formData.get("fromClientId") ?? "").trim();
  if (!portalUserId || !clientId) return;

  // Scope the delete to this org's portal user.
  const pu = await prisma.portalUser.findFirst({ where: { id: portalUserId, orgId }, select: { id: true } });
  if (!pu) return;
  await prisma.portalUserClient.deleteMany({ where: { portalUserId, clientId } });

  await writeSystemAuditEvent({
    orgId, actorUserId: user.id,
    entityType: "PortalUser", entityId: portalUserId,
    action: "PORTAL_USER_ACCOUNT_UNLINKED",
    summary: `Removed an additional client account from a portal login`,
  }).catch(() => {});

  if (fromClientId) revalidatePath(`/clients/${fromClientId}`);
}

/** Deactivate (revoke) a portal login. */
export async function togglePortalUserAction(formData: FormData): Promise<void> {
  const { user, orgId, org } = await requireOrgSession();
  if (!canManagePortal(user.role)) return;
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const id = String(formData.get("portalUserId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!id) return;

  const target = await prisma.portalUser.findFirst({ where: { id, orgId }, select: { id: true, isActive: true } });
  if (!target) return;

  await prisma.portalUser.update({ where: { id }, data: { isActive: !target.isActive } });
  // Revoking access should also end any live sessions.
  if (target.isActive) await prisma.portalSession.deleteMany({ where: { portalUserId: id } });

  await writeSystemAuditEvent({
    orgId,
    actorUserId: user.id,
    entityType: "PortalUser",
    entityId: id,
    action: target.isActive ? "PORTAL_USER_DEACTIVATED" : "PORTAL_USER_REACTIVATED",
    summary: `Portal access ${target.isActive ? "revoked" : "restored"}`,
  });

  if (clientId) revalidatePath(`/clients/${clientId}`);
}
