export const COMMUNICATIONS_ROUTES = {
  home: "/communications",
  outbox: "/communications/outbox",
  templates: "/communications/templates",
  policies: "/communications/policies",
  whatsapp: "/communications/whatsapp",
  /** Personal notification preferences stay under Settings. */
  preferences: "/settings/notifications",
  /** Legacy paths — redirect stubs only. */
  legacyOutbox: "/settings/notifications/outbox",
  legacyTemplates: "/settings/notifications/templates",
  legacyWhatsapp: "/settings/notifications/whatsapp",
  shortcutOutbox: "/outbox",
} as const;

export type CommunicationsNavKey = "outbox" | "templates" | "whatsapp" | "policies";

export const COMMUNICATIONS_NAV: Array<{
  key: CommunicationsNavKey;
  href: string;
  label: string;
  description: string;
  roles: readonly ("ADMIN" | "OPS")[] | readonly ["ADMIN"];
}> = [
  {
    key: "outbox",
    href: COMMUNICATIONS_ROUTES.outbox,
    label: "Outbox",
    description: "Delivery queue and retries",
    roles: ["ADMIN", "OPS"],
  },
  {
    key: "templates",
    href: COMMUNICATIONS_ROUTES.templates,
    label: "Templates",
    description: "WhatsApp and email templates",
    roles: ["ADMIN", "OPS"],
  },
  {
    key: "policies",
    href: COMMUNICATIONS_ROUTES.policies,
    label: "Policies",
    description: "Status-triggered messaging rules",
    roles: ["ADMIN", "OPS"],
  },
  {
    key: "whatsapp",
    href: COMMUNICATIONS_ROUTES.whatsapp,
    label: "WhatsApp",
    description: "Provider connection",
    roles: ["ADMIN"],
  },
];

export function communicationsNavForRole(role: string) {
  return COMMUNICATIONS_NAV.filter((item) => (item.roles as readonly string[]).includes(role));
}

export function canAccessCommunications(role: string) {
  return communicationsNavForRole(role).length > 0;
}
