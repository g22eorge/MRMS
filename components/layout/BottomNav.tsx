"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { can } from "@/lib/permissions";
import type { Role } from "@prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

/* ── icons ── */
const homeIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
  </svg>
);
const jobsIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14v6"/><path d="M15 14v6"/><path d="M9 18h6"/>
  </svg>
);
const boardIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/>
  </svg>
);
const profileIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>
  </svg>
);
const moreIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
  </svg>
);
const intakeIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const clientsIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const reportsIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
  </svg>
);
const usersIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>
  </svg>
);
const brandingIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);
const payoutsIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const inventoryIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h18v13H3z"/><path d="M3 7l3-4h12l3 4"/><path d="M9 12h6"/>
  </svg>
);
const messagesIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const notificationsIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/>
    <path d="M9 17a3 3 0 0 0 6 0"/>
  </svg>
);
const invoiceIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <path d="M14 2v6h6"/>
    <path d="M8 13h8"/>
    <path d="M8 17h5"/>
  </svg>
);

/* ── named items ── */
const ITEMS = {
  dashboard:   { href: "/dashboard",            label: "Home",      icon: homeIcon },
  jobs:        { href: "/jobs",                  label: "Queue",     icon: jobsIcon },
  board:       { href: "/technicians",           label: "Board",     icon: boardIcon },
  intake:      { href: "/intake",                label: "Requests",  icon: intakeIcon },
  clients:     { href: "/clients",               label: "Clients",   icon: clientsIcon },
  reports:     { href: "/reports",               label: "Reports",   icon: reportsIcon },
  inventory:   { href: "/inventory",             label: "Inventory", icon: inventoryIcon },
  payoutFollowups: { href: "/payout-followups",  label: "Payment Follow-up", icon: payoutsIcon },
  payouts:     { href: "/technicians/payouts",   label: "Payouts",   icon: payoutsIcon },
  users:       { href: "/settings/users",        label: "Users",     icon: usersIcon },
  branding:    { href: "/settings/branding",     label: "Branding",  icon: brandingIcon },
  commsTemplates: { href: "/settings/notifications/templates", label: "Comms", icon: messagesIcon },
  notifications: { href: "/settings/notifications", label: "Notifications", icon: notificationsIcon },
  profile:     { href: "/settings/profile",      label: "Profile",   icon: profileIcon },
  jobCards:    { href: "/documents/job-cards",   label: "Intake Inv", icon: invoiceIcon },
  quotations:  { href: "/documents/quotations",  label: "Quotes",    icon: invoiceIcon },
  invoiceDocs: { href: "/documents/invoices",    label: "Invoices",  icon: invoiceIcon },
} satisfies Record<string, NavItem>;

/* ── role-based nav config ── */
function getPrimaryItems(role: Role, permissions: string[]): NavItem[] {
  const permUser = { role, permissions };

  if (role === "TECHNICIAN_EXTERNAL") {
    return [ITEMS.dashboard, ITEMS.jobs, ITEMS.payouts];
  }
  if (role === "INTAKE") {
    return [ITEMS.dashboard, ITEMS.intake, ITEMS.jobs];
  }
  if (role === "ADMIN" || role === "OPS") {
    return [ITEMS.dashboard, ITEMS.jobs, ITEMS.intake];
  }
  // TECHNICIAN_INTERNAL
  if (can.viewClientInfo(permUser)) {
    // has can_intake permission
    return [ITEMS.dashboard, ITEMS.intake, ITEMS.jobs];
  }
  return [ITEMS.dashboard, ITEMS.jobs, ITEMS.board];
}

function getExtraItems(role: Role, permissions: string[]): NavItem[] {
  const items: NavItem[] = [];
  const permUser = { role, permissions };

  if (role === "ADMIN") {
    items.push(ITEMS.jobCards, ITEMS.quotations, ITEMS.invoiceDocs, ITEMS.clients, ITEMS.inventory, ITEMS.reports, ITEMS.payoutFollowups, ITEMS.board, ITEMS.users, ITEMS.branding, ITEMS.commsTemplates);
  } else if (role === "OPS") {
    items.push(ITEMS.jobCards, ITEMS.quotations, ITEMS.invoiceDocs, ITEMS.clients, ITEMS.inventory, ITEMS.reports, ITEMS.payoutFollowups, ITEMS.board, ITEMS.commsTemplates);
  } else if (role === "INTAKE") {
    items.push(ITEMS.jobCards, ITEMS.clients, ITEMS.board);
  } else if (role === "TECHNICIAN_INTERNAL" && can.viewClientInfo(permUser)) {
    // has can_intake — board wasn't in primary
    items.push(ITEMS.jobCards, ITEMS.quotations, ITEMS.clients, ITEMS.inventory, ITEMS.board);
  } else if (role === "TECHNICIAN_INTERNAL") {
    items.push(ITEMS.jobCards, ITEMS.quotations, ITEMS.inventory);
  }
  if (can.generateJobCards(permUser) && !items.some((item) => item.href === ITEMS.jobCards.href)) {
    items.push(ITEMS.jobCards);
  }
  if (can.viewFinancials(permUser) && !items.some((item) => item.href === ITEMS.quotations.href)) {
    items.push(ITEMS.quotations);
  }
  if (can.viewFinancials(permUser) && !items.some((item) => item.href === ITEMS.invoiceDocs.href)) {
    items.push(ITEMS.invoiceDocs);
  }
  if ((can.reviewExternalBills(permUser) || can.approveInvoices(permUser)) && !items.some((item) => item.href === ITEMS.payoutFollowups.href)) {
    items.push(ITEMS.payoutFollowups);
  }
  items.push(ITEMS.notifications);
  // TECHNICIAN_EXTERNAL: payouts is in primary; board goes in More
  if (role === "TECHNICIAN_EXTERNAL") {
    items.push(ITEMS.board);
  }
  // Plain TECHNICIAN_INTERNAL (no can_intake): no extra items needed

  return items;
}

export function BottomNav({ role, permissions = [] }: { role: Role; permissions: string[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const primaryItems = getPrimaryItems(role, permissions);
  const extraItems   = getExtraItems(role, permissions);
  const hasExtra     = extraItems.length > 0;

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const anyExtraActive = extraItems.some((e) => isActive(e.href));

  return (
    <>
      <nav className="mobile-bottom-nav glass fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          {primaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                isActive(item.href)
                  ? "text-[var(--accent)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <span className={`transition-transform ${isActive(item.href) ? "scale-110" : ""}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}

          {hasExtra && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                anyExtraActive ? "text-[var(--accent)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <span className={`transition-transform ${anyExtraActive ? "scale-110" : ""}`}>
                {moreIcon}
              </span>
              <span>More</span>
            </button>
          )}

          <Link
            href={ITEMS.profile.href}
            onClick={() => setOpen(false)}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
              isActive(ITEMS.profile.href)
                ? "text-[var(--accent)]"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <span className={`transition-transform ${isActive(ITEMS.profile.href) ? "scale-110" : ""}`}>
              {ITEMS.profile.icon}
            </span>
            <span>{ITEMS.profile.label}</span>
          </Link>
        </div>
      </nav>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-16 z-50 mx-auto max-w-sm rounded-t-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">More</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {extraItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    isActive(item.href)
                      ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[#9A7A00]"
                      : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)] hover:border-[var(--accent)]/30"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
