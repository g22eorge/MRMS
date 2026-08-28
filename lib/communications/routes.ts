/**
 * These pointed at /communications/*, which is where the pages used to live.
 * They are now redirect stubs into Settings, and the labelling here had it
 * exactly backwards — the paths marked "legacy" are the real pages.
 *
 * That inversion was not cosmetic. Every filter chip, search box and pagination
 * link on the Outbox, and all twenty save/error redirects on Templates, were
 * built from these constants, so each one bounced through a stub that forwards
 * nothing: the query string was dropped on the way. Filtering the outbox landed
 * on unfiltered page 1, and a rejected template save looked identical to a
 * successful one because the error banner's parameter never arrived.
 *
 * Pointing them at the real pages removes the hop rather than patching it.
 */
export const COMMUNICATIONS_ROUTES = {
  home: "/communications",
  outbox: "/settings/notifications/outbox",
  templates: "/settings/notifications/templates",
  policies: "/settings/notifications/templates#policies",
  whatsapp: "/settings/notifications/whatsapp",
  /** Personal notification preferences. */
  preferences: "/settings/notifications",
  /** Old paths, kept as stubs so existing bookmarks still land somewhere. */
  legacyOutbox: "/communications/outbox",
  legacyTemplates: "/communications/templates",
  legacyWhatsapp: "/communications/whatsapp",
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
