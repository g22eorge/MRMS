import type { ReactNode } from "react";

import { SettingsShell, type SettingsNavGroup, type SettingsNavItem } from "@/components/settings/SettingsShell";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { user } = await requireOrgSession();

  const permUser = { role: user.role, permissions: user.permissions };
  const isAdmin = user.role === "ADMIN";
  const isOps = user.role === "ADMIN" || user.role === "OPS";
  const canTargets = user.role === "ADMIN" || user.role === "SALES";

  const items = {
    profile: {
      href: "/settings/profile",
      label: "Profile",
      description: "Your account details",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M10 2.75a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5ZM4.5 16.25A5.5 5.5 0 0 1 10 11.5h0a5.5 5.5 0 0 1 5.5 4.75.75.75 0 0 1-.743.875H5.243a.75.75 0 0 1-.743-.875Z" clipRule="evenodd" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    users: {
      href: "/settings/users",
      label: "Users",
      description: "Roles and access",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path d="M2.046 15.253c-.18.01-.34-.092-.382-.266a6.5 6.5 0 0 1 11.672 0c-.042.174-.202.276-.382.266a34.816 34.816 0 0 0-10.908 0Z" />
          <path d="M16.75 9.5a.75.75 0 0 0-1.5 0v1.25H14a.75.75 0 0 0 0 1.5h1.25V13.5a.75.75 0 0 0 1.5 0v-1.25H18a.75.75 0 0 0 0-1.5h-1.25V9.5Z" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    groups: {
      href: "/settings/groups",
      label: "Groups",
      description: "Groups and permissions",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M10 2.75a7.25 7.25 0 0 0-6.65 4.36.75.75 0 1 0 1.38.59A5.75 5.75 0 0 1 15.5 10a.75.75 0 0 0 1.5 0A7.25 7.25 0 0 0 10 2.75Zm-6.5 9a.75.75 0 0 0-1.5 0A7.25 7.25 0 0 0 10 19.25a7.25 7.25 0 0 0 6.65-4.36.75.75 0 0 0-1.38-.59A5.75 5.75 0 0 1 4.5 11.75Z" clipRule="evenodd" />
          <path d="M6 9.25a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5A.75.75 0 0 1 6 9.25Zm2 3a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Z" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    branches: {
      href: "/settings/branches",
      label: "Branches",
      description: "Branches and locations",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9a1.5 1.5 0 0 0 3 0v-9A1.5 1.5 0 0 0 9.5 6ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 10Z" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    notifications: {
      href: "/settings/notifications",
      label: "Notifications",
      description: "Alerts and personal preferences",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M9.5 2.5a.5.5 0 0 1 1 0v.25a6.5 6.5 0 0 1 5.5 6.428v2.656c0 .555.22 1.086.612 1.478l.284.284a.75.75 0 0 1-.53 1.28H3.634a.75.75 0 0 1-.53-1.28l.284-.284A2.09 2.09 0 0 0 4 11.834V9.178A6.5 6.5 0 0 1 9.5 2.75V2.5Z" />
          <path d="M7.25 15.5a2.75 2.75 0 0 0 5.5 0h-5.5Z" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    templates: {
      href: COMMUNICATIONS_ROUTES.templates,
      label: "Templates",
      description: "WhatsApp and email",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M3.5 4.75A1.75 1.75 0 0 1 5.25 3h9.5A1.75 1.75 0 0 1 16.5 4.75v10.5A1.75 1.75 0 0 1 14.75 17h-9.5A1.75 1.75 0 0 1 3.5 15.25V4.75Zm2.75.75a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Zm0 3a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Zm0 3a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5h-4Z" clipRule="evenodd" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    whatsapp: {
      href: COMMUNICATIONS_ROUTES.whatsapp,
      label: "WhatsApp",
      description: "Provider connection",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M10 2.5a7.5 7.5 0 0 0-6.44 11.33L2.5 17.5l3.77-1a7.5 7.5 0 1 0 3.73-14Zm0 1.5a6 6 0 1 1-3.1 11.14.75.75 0 0 0-.6-.08l-1.9.5.52-1.83a.75.75 0 0 0-.08-.6A6 6 0 0 1 10 4Zm-2.1 3.1c-.14 0-.36.05-.55.26-.19.2-.72.7-.72 1.72s.74 1.99.84 2.13c.1.14 1.44 2.29 3.56 3.12 1.76.7 2.12.56 2.5.52.38-.03 1.23-.5 1.4-.99.18-.48.18-.9.13-.99-.05-.08-.19-.13-.4-.24-.2-.1-1.23-.6-1.42-.67-.19-.07-.33-.1-.47.1-.14.21-.54.68-.66.82-.12.14-.24.15-.45.05-.2-.1-.86-.32-1.64-1.01-.6-.54-1.01-1.2-1.13-1.4-.12-.21-.01-.32.09-.42.09-.09.2-.24.3-.36.1-.12.14-.2.2-.34.07-.14.03-.26-.02-.36-.05-.1-.46-1.12-.63-1.53-.16-.4-.33-.34-.46-.35h-.4Z" clipRule="evenodd" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    outbox: {
      href: COMMUNICATIONS_ROUTES.outbox,
      label: "Outbox",
      description: "Delivery queue and retries",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M3.4 3.3a.75.75 0 0 0-1 .93l1.9 5.02a.75.75 0 0 0 .7.48h5a.75.75 0 0 1 0 1.5H5a.75.75 0 0 0-.7.48l-1.9 5.02a.75.75 0 0 0 1 .93l14-6.5a.75.75 0 0 0 0-1.36l-14-6.5Z" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    targets: {
      href: "/settings/targets",
      label: "Sales Targets",
      description: "Monthly revenue targets",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <circle cx="10" cy="10" r="1" fill="currentColor" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    billing: {
      href: "/settings/billing",
      label: "Billing",
      description: "Plan, renewal, and invoices",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9.25 5.5a.75.75 0 0 1 1.5 0v.34c.8.1 1.52.43 2.05.92a.75.75 0 0 1-1.02 1.1 2.27 2.27 0 0 0-1.03-.55V9.5c.65.18 1.26.5 1.76.92.6.5.96 1.15.96 1.83s-.36 1.33-.96 1.83c-.5.42-1.11.74-1.76.92v.4a.75.75 0 0 1-1.5 0v-.35a4.66 4.66 0 0 1-2.26-1.07.75.75 0 1 1 .95-1.16c.38.31.83.52 1.31.62V11a3.9 3.9 0 0 1-1.46-.74c-.52-.43-.84-1.02-.84-1.66s.32-1.23.84-1.66c.41-.34.93-.58 1.46-.71V5.5Z" clipRule="evenodd" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    branding: {
      href: "/settings/branding",
      label: "Branding",
      description: "Company + documents",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M10 2c-3.866 0-7 1.343-7 3v10c0 1.657 3.134 3 7 3s7-1.343 7-3V5c0-1.657-3.134-3-7-3Zm0 1.5c3.314 0 5.5 1.074 5.5 1.5S13.314 6.5 10 6.5 4.5 5.426 4.5 5 6.686 3.5 10 3.5Zm5.5 4.05c-1.2.76-3.22 1.2-5.5 1.2s-4.3-.44-5.5-1.2V10c0 .426 2.186 1.5 5.5 1.5s5.5-1.074 5.5-1.5V7.55Zm0 4c-1.2.76-3.22 1.2-5.5 1.2s-4.3-.44-5.5-1.2V14c0 .426 2.186 1.5 5.5 1.5s5.5-1.074 5.5-1.5v-2.45Z" clipRule="evenodd" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    dataHeal: {
      href: "/settings/data-heal",
      label: "Data Heal",
      description: "Diagnostics and repairs",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M8.5 2.75a.75.75 0 0 1 .75.75v2.94l1.72-1.72a.75.75 0 1 1 1.06 1.06L10.31 7.5h2.94a.75.75 0 0 1 0 1.5h-2.94l1.72 1.72a.75.75 0 1 1-1.06 1.06L9.25 10.06V13a.75.75 0 0 1-1.5 0v-2.94l-1.72 1.72a.75.75 0 1 1-1.06-1.06L6.69 9H3.75a.75.75 0 0 1 0-1.5h2.94L4.97 5.78a.75.75 0 0 1 1.06-1.06L7.75 6.44V3.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
        </svg>
      ),
    } satisfies SettingsNavItem,
    audit: {
      href: "/settings/audit",
      label: "Audit Log",
      description: "Full activity history",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M4.75 2.5A1.75 1.75 0 0 0 3 4.25v11.5A1.75 1.75 0 0 0 4.75 17.5h10.5A1.75 1.75 0 0 0 17 15.75V7.6a1.75 1.75 0 0 0-.5-1.23l-3.37-3.37a1.75 1.75 0 0 0-1.24-.5H4.75Zm1.5 6.25a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Zm0 3a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5h-4Z" clipRule="evenodd" />
        </svg>
      ),
    } satisfies SettingsNavItem,
  };

  const groups: SettingsNavGroup[] = [
    {
      title: "Account",
      items: [
        items.profile,
        isAdmin ? items.users : null,
        isAdmin ? items.groups : null,
        isAdmin ? items.branches : null,
      ].filter(Boolean) as SettingsNavItem[],
    },
    {
      title: "Notifications",
      items: [
        can.viewNotifications(permUser) ? items.notifications : null,
        isOps ? items.templates : null,
        isAdmin ? items.whatsapp : null,
        isOps ? items.outbox : null,
      ].filter(Boolean) as SettingsNavItem[],
    },
    {
      title: "Business",
      items: [
        canTargets ? items.targets : null,
        isAdmin ? items.billing : null,
        isAdmin ? items.branding : null,
      ].filter(Boolean) as SettingsNavItem[],
    },
    {
      title: "System",
      items: [
        isAdmin ? items.dataHeal : null,
        isAdmin ? items.audit : null,
      ].filter(Boolean) as SettingsNavItem[],
    },
  ].filter((g) => g.items.length > 0);

  return <SettingsShell groups={groups}>{children}</SettingsShell>;
}
