"use client";

import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { can } from "@/lib/permissions";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { isEntityRecordId } from "@/lib/page-state/contract";

function pageMeta(pathname: string, role: Role) {
  const parts = pathname.split("/").filter(Boolean);

  if (pathname === "/dashboard") {
    if (role === "TECHNICIAN_EXTERNAL") {
      return { title: "Dashboard", description: "Track your assigned jobs and payout status in one view." };
    }
    if (role === "TECHNICIAN_INTERNAL") {
      return { title: "Dashboard", description: "Focus on your active queue: diagnosing, repair, and completed jobs." };
    }
    if (role === "OPS") {
      return { title: "Dashboard", description: "Manage referrals, billing visibility, client approvals, and handoff into active repair." };
    }
    if (role === "FRONT_DESK") {
      return { title: "Dashboard", description: "Capture new intake jobs and respond to client updates with read-only progress visibility." };
    }
    if (role === "ADMIN") {
      return { title: "Dashboard", description: "Unified operations and financial control for repair performance." };
    }
    return { title: "Dashboard", description: "Keep intake, diagnostics, approvals, and closure in one live queue." };
  }
  if (pathname === "/jobs") return { title: "Jobs", description: "Track intake, repair progress, and completion at a glance." };
  if (pathname === "/jobs/new") return { title: "New Job Intake", description: "Capture client, device, issue, and submission details." };
  if (parts[0] === "jobs" && parts[1] && parts[2] === "edit") {
    return { title: "Edit Job", description: "Update job details and technician notes." };
  }
  if (parts[0] === "jobs" && parts[1]) {
    return { title: "Job Details", description: "Review status, diagnosis, repair log, financials, and timeline." };
  }
  if (pathname === "/clients") return { title: "Clients", description: "Directory, engagement level, and quick access to client history." };
  if (parts[0] === "clients" && parts[1]) {
    return { title: "Client Details", description: "View client profile, job history, and notes timeline." };
  }
  if (pathname === "/reports") return { title: "Reports", description: "Operational and financial insights for repair performance." };
  if (pathname === "/ai-insights") return { title: "AI Insights", description: "Decision support across repairs, sales, finance, inventory, and operational risk." };
  if (pathname === "/inventory") return { title: "Inventory", description: "Track inventory item stock, reservations, and reorder risk." };
  if (pathname === "/payout-followups") return { title: "Collections & Payouts", description: "Collect client payments, pay external techs, track supplier bills." };
  if (pathname === "/technicians") return { title: "Technician Portal", description: "Prioritized queue for assigned repair work." };
  if (pathname === "/technicians/payouts") return { title: "Technician Payouts", description: "Track paid and unpaid fees across your external assignments." };
  if (pathname === "/settings/users") return { title: "User Management", description: "Create users, assign roles, and manage active access." };
  if (pathname === "/documents/receipts") return { title: "Receipts", description: "Track payments, receipt PDFs, and collection history." };
  if (pathname === "/documents/invoices") return { title: "Invoices", description: "Issue, collect, and monitor customer invoices." };
  if (pathname === "/documents/job-cards") return { title: "Job Cards", description: "Generate intake documents and handoff cards." };
  if (pathname === "/documents/quotations") return { title: "Quotations", description: "Prepare repair and sales quotes for approval." };
  if (pathname === "/settings/branding") return { title: "Branding", description: "Manage invoice logo, company details, VAT defaults, and document colours." };
  if (pathname === "/settings/profile") return { title: "Profile", description: "Update your personal account details and contact info." };
  if (pathname === "/settings/notifications") return { title: "Notifications", description: "Choose which job events trigger alerts for your account." };
  if (pathname === "/settings/notifications/templates") return { title: "Comms Templates", description: "Manage message templates, nudge sequencing, and status-channel policy rules." };
  if (pathname === "/settings/notifications/outbox") return { title: "Outbox", description: "Delivery queue for outbound WhatsApp and email notifications." };
  if (pathname === COMMUNICATIONS_ROUTES.outbox) return { title: "Outbox", description: "Delivery queue for outbound WhatsApp and email notifications." };
  if (pathname === COMMUNICATIONS_ROUTES.templates) return { title: "Comms Templates", description: "Manage message templates, nudge sequencing, and status-channel policy rules." };
  if (pathname === COMMUNICATIONS_ROUTES.whatsapp) return { title: "WhatsApp", description: "Configure Meta WhatsApp Business connection for this workspace." };
  if (pathname.startsWith("/communications")) return { title: "Communications", description: "Outbox delivery, templates, WhatsApp config, and status policies." };
  if (pathname === "/intake") return { title: "Repair Requests", description: "Incoming website requests awaiting intake conversion." };
  if (pathname === "/documents/credit-notes") return { title: "Credit Notes", description: "Sales returns, adjustments, and item return tracking." };
  if (pathname === "/documents/refunds") return { title: "Refunds", description: "Track refunds issued against receipts and sales." };
  if (pathname === "/documents/delivery-notes") return { title: "Delivery Notes", description: "Delivery and handover proof for paid invoices and sales." };
  if (pathname === "/pos") return { title: "Point of Sale", description: "Walk-in and retail sales transactions." };
  if (parts[0] === "pos" && parts[1]) {
    // No subtitle here on purpose. This used to read `Ref ${id.slice(0, 8)}`,
    // built from the URL, so a sale that does not exist was still topped by a
    // confident "Sale Details · Ref does-not". Jobs and clients already leave
    // this to the resolver below, which asks the record for its real number and
    // shows nothing when there is no record to ask.
    return { title: "Sale Details", description: "Review sale lines, payments, and receipt actions." };
  }
  if (pathname === "/finance") return { title: "Finance Hub", description: "Cash position, collections, payouts, and financial control." };
  if (pathname === "/sales") return { title: "Sales", description: "Leads pipeline and quotations." };
  if (pathname === "/service") return { title: "Service Hub", description: "Field visits, technicians, and complaints." };

  // Fallback: derive a readable section name from the first path segment rather
  // than the generic "Workspace" (a nav super-group, not a page). Keeps unmapped
  // routes — procurement, targets, field, settings sub-pages — labelled sensibly.
  const section = parts[0];
  if (section) {
    const title = section.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return { title };
  }
  return { title: "Workspace" };
}

async function fetchJobNumber(id: string) {
  const res = await fetch(`/api/meta/job/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  const data = (await res.json()) as { jobNumber?: string };
  return data.jobNumber ?? null;
}

async function fetchSaleNumber(id: string) {
  const res = await fetch(`/api/meta/sale/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  const data = (await res.json()) as { saleNumber?: string };
  return data.saleNumber ?? null;
}

async function fetchClientName(id: string) {
  const res = await fetch(`/api/meta/client/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  const data = (await res.json()) as { fullName?: string };
  return data.fullName ?? null;
}

/**
 * PRIMARY_TABS — the 5 bottom-nav tabs that are "home" screens.
 * These have their own custom native headers on mobile, so:
 *   • PageThemeHeader is hidden (hideMobile = true)
 *   • No back button shown
 *
 * Every other page (even single-segment ones like /clients, /inventory,
 * /payout-followups) navigated to FROM somewhere — they all get a back arrow.
 */
const PRIMARY_TABS = new Set<string>([
  "/dashboard",           // Home tab
  "/jobs",                // Repairs tab
  "/documents/invoices",  // Invoices tab
  "/reports",             // Activity tab
  "/more",                // More tab
]);

function isPrimaryMobileTab(pathname: string, role: Role, permissions: string[]) {
  if (PRIMARY_TABS.has(pathname)) return true;
  if (pathname !== "/technicians") return false;
  return role === "TECHNICIAN_EXTERNAL" || !can.viewIntake({ role, permissions });
}

// On mobile, only the primary tab pages have their own native headers
function isMobileRootPage(pathname: string, role: Role, permissions: string[]) {
  return isPrimaryMobileTab(pathname, role, permissions);
}

export function PageThemeHeader({ role, permissions = [] }: { role: Role; permissions?: string[] }) {
  const pathname = usePathname();
  const meta = pageMeta(pathname, role);
  const [resolvedSubtitle, setResolvedSubtitle] = useState<{ path: string; text: string } | null>(null);
  const hideMobile = isMobileRootPage(pathname, role, permissions); // primary-tab pages have own native headers

  useEffect(() => {
    let cancelled = false;
    const parts = pathname.split("/").filter(Boolean);
    setResolvedSubtitle(null);

    const load = async () => {
      if (parts[0] === "jobs" && parts[1] && isEntityRecordId(parts[1])) {
        const jobNumber = await fetchJobNumber(parts[1]);
        if (!cancelled && jobNumber) {
          setResolvedSubtitle({ path: pathname, text: jobNumber });
        }
        return;
      }
      if (parts[0] === "clients" && parts[1] && isEntityRecordId(parts[1])) {
        const clientName = await fetchClientName(parts[1]);
        if (!cancelled && clientName) {
          setResolvedSubtitle({ path: pathname, text: clientName });
        }
        return;
      }
      if (parts[0] === "pos" && parts[1] && isEntityRecordId(parts[1])) {
        const saleNumber = await fetchSaleNumber(parts[1]);
        if (!cancelled && saleNumber) {
          setResolvedSubtitle({ path: pathname, text: saleNumber });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Only ever a resolved identifier. No page supplies a fallback any more, so
  // the chip is absent until a record answers with its own number or name, and
  // stays absent when there is no record.
  const subtitle = resolvedSubtitle?.path === pathname ? resolvedSubtitle.text : null;

  // Communications and Documents routes render their own section header
  // (title + tabs) via their shells, so the app-wide page header would just
  // duplicate it.
  if (pathname.startsWith("/communications") || pathname.startsWith("/documents")) return null;

  return (
    <>
      {/* Mobile: hidden on primary-tab pages (own native headers).
          On all other pages: show page title only.
          Back button is now in the sticky Header bar above, not here. */}
      <div className={`flex items-center gap-2 sm:hidden ${hideMobile ? "hidden" : ""}`}>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h1 className="text-[0.9375rem] font-bold tracking-tight text-[var(--ink)]">{meta.title}</h1>
          {subtitle ? (
            <span className="rounded border border-[var(--line)] bg-[var(--panel-strong)] px-1.5 py-0.5 mono text-[0.75rem] font-medium text-[var(--ink-muted)]">
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>

      {/* sm+: flat title bar with a single accent tick — matches the calm shell */}
      <section className="hidden items-center gap-3 rounded-2xl bg-[var(--dc-panel)] px-4 py-2.5 shadow-[var(--dc-shadow)] sm:flex">
        <div className="h-5 w-[3px] shrink-0 rounded-full bg-[var(--dc-accent)]" />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
          <h1 className="text-[0.8125rem] font-bold tracking-tight text-[var(--dc-ink)]">{meta.title}</h1>
          {subtitle ? (
            <span className="rounded border border-[var(--dc-line)] bg-[var(--dc-panel-2)] px-1.5 py-0.5 text-[0.75rem] mono font-medium text-[var(--dc-ink-3)]">
              {subtitle}
            </span>
          ) : null}
          {meta.description ? (
            <span className="text-[0.8125rem] text-[var(--dc-ink-3)]">{meta.description}</span>
          ) : null}
        </div>
      </section>
    </>
  );
}
