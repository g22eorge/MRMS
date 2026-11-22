import { prisma } from "@/lib/prisma";

/**
 * Per-organisation WhatsApp / SMS provider credentials.
 *
 * `OrgWhatsAppConfig` is now a real model. This module previously created the
 * table on every call and then patched in the Africa's Talking columns with
 * `PRAGMA table_info` plus conditional `ALTER TABLE` — the whole apparatus is
 * replaced by migrations.
 */

export interface OrgWhatsAppConfig {
  orgId: string;
  businessNumber: string;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  provider: string;
  // Africa's Talking SMS
  atApiKey: string | null;
  atUsername: string | null;
  atSenderId: string | null;
  smsFallback: boolean;
}

type ConfigRow = {
  orgId: string;
  businessNumber: string;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string | null;
  provider: string;
  atApiKey: string | null;
  atUsername: string | null;
  atSenderId: string | null;
  smsFallback: boolean;
};

function toConfig(row: ConfigRow): OrgWhatsAppConfig {
  return {
    orgId: row.orgId,
    businessNumber: row.businessNumber,
    phoneNumberId: row.phoneNumberId,
    accessToken: row.accessToken,
    // Callers treat this as a plain string; keep the empty-string contract.
    businessAccountId: row.businessAccountId ?? "",
    provider: row.provider,
    atApiKey: row.atApiKey,
    atUsername: row.atUsername,
    atSenderId: row.atSenderId,
    smsFallback: row.smsFallback,
  };
}

export async function getOrgWhatsAppConfig(orgId: string): Promise<OrgWhatsAppConfig | null> {
  try {
    const row = await prisma.orgWhatsAppConfig.findUnique({ where: { orgId } });
    return row ? toConfig(row) : null;
  } catch {
    return null;
  }
}

/**
 * Which tenant owns the WhatsApp business number a webhook arrived on.
 *
 * Meta sends `metadata.phone_number_id` on every inbound message, and each org
 * registers its own, so this is the only reliable way to tell whose customer is
 * writing in. Without it the webhook matched clients by phone number across the
 * whole database.
 */
export async function findOrgIdByWhatsAppPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  if (!phoneNumberId) return null;
  try {
    const row = await prisma.orgWhatsAppConfig.findFirst({
      where: { phoneNumberId },
      select: { orgId: true },
    });
    return row?.orgId ?? null;
  } catch {
    return null;
  }
}

export async function saveOrgWhatsAppConfig(
  orgId: string,
  config: Omit<OrgWhatsAppConfig, "orgId">,
): Promise<void> {
  const data = {
    businessNumber: config.businessNumber,
    phoneNumberId: config.phoneNumberId,
    accessToken: config.accessToken,
    businessAccountId: config.businessAccountId || null,
    provider: config.provider,
    atApiKey: config.atApiKey ?? null,
    atUsername: config.atUsername ?? null,
    atSenderId: config.atSenderId ?? null,
    smsFallback: config.smsFallback,
  };

  await prisma.orgWhatsAppConfig.upsert({
    where: { orgId },
    create: { orgId, ...data },
    update: data,
  });
}

export async function setOrgAtSenderId(orgId: string, senderId: string | null): Promise<void> {
  // Creates a stub row when the org has no WhatsApp config yet, so an SMS
  // sender id can be set independently of the Meta credentials.
  await prisma.orgWhatsAppConfig.upsert({
    where: { orgId },
    create: {
      orgId,
      businessNumber: "",
      phoneNumberId: "",
      accessToken: "",
      businessAccountId: null,
      provider: "meta",
      atSenderId: senderId,
    },
    update: { atSenderId: senderId },
  });
}

export async function deleteOrgWhatsAppConfig(orgId: string): Promise<void> {
  await prisma.orgWhatsAppConfig.deleteMany({ where: { orgId } });
}
