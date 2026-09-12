"use client";

import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { can } from "@/lib/permissions";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { isEntityRecordId } from "@/lib/page-state/contract";

function pageMeta(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);

  // One title for every role. This branched six ways to vary a description
  // that no longer exists, leaving six identical returns.
  if (pathname === "/dashboard") return { title: "Dashboard" };
  if (pathname === "/jobs") return { title: "Jobs" };
  if (pathname === "/jobs/new") return { title: "New Job Intake" };
  if (parts[0] === "jobs" && parts[1] && parts[2] === "edit") {
    return { title: "Edit Job" };
  }
  if (parts[0] === "jobs" && parts[1]) {
    return { title: "Job Details" };
  }
  if (pathname === "/clients") return { title: "Clients" };
  if (parts[0] === "clients" && parts[1]) {
    return { title: "Client Details" };
  }
  if (pathname === "/reports") return { title: "Reports" };
  if (pathname === "/ai-insights") return { title: "AI Insights" };
  if (pathname === "/inventory") return { title: "Inventory" };
  if (pathname === "/payout-followups") return { title: "Collections & Payouts", description: "Collect client payments, pay external techs, track supplier bills." };
  if (pathname === "/technicians") return { title: "Technician Portal" };
  if (pathname === "/technicians/payouts") return { title: "Technician Payouts" };
  if (pathname === "/settings/users") return { title: "User Management" };
  if (pathname === "/documents/receipts") return { title: "Receipts" };
  if (pathname === "/documents/invoices") return { title: "Invoices" };
  if (pathname === "/documents/job-cards") return { title: "Job Cards" };
  if (pathname === "/documents/quotations") return { title: "Quotations" };
  if (pathname === "/settings/branding") return { title: "Branding", description: "Manage invoice logo, company details, VAT defaults, and document colours." };
  if (pathname === "/settings/profile") return { title: "Profile" };
  if (pathname === "/settings/notifications") return { title: "Notifications" };
  if (pathname === "/settings/notifications/templates") return { title: "Comms Templates", description: "Manage message templates, nudge sequencing, and status-channel policy rules." };
  if (pathname === "/settings/notifications/outbox") return { title: "Outbox", description: "Delivery queue for outbound WhatsApp and email notifications." };
  if (pathname === COMMUNICATIONS_ROUTES.outbox) return { title: "Outbox", description: "Delivery queue for outbound WhatsApp and email notifications." };
  if (pathname === COMMUNICATIONS_ROUTES.templates) return { title: "Comms Templates", description: "Manage message templates, nudge sequencing, and status-channel policy rules." };
  if (pathname === COMMUNICATIONS_ROUTES.whatsapp) return { title: "WhatsApp" };
  if (pathname.startsWith("/communications")) return { title: "Communications" };
  if (pathname === "/intake") return { title: "Repair Requests" };
  if (pathname === "/documents/credit-notes") return { title: "Credit Notes" };
  if (pathname === "/documents/refunds") return { title: "Refunds" };
  if (pathname === "/documents/delivery-notes") return { title: "Delivery Notes" };
  if (pathname === "/pos") return { title: "Point of Sale" };
  if (parts[0] === "pos" && parts[1]) {
    // No subtitle here on purpose. This used to read `Ref ${id.slice(0, 8)}`,
    // built from the URL, so a sale that does not exist was still topped by a
    // confident "Sale Details · Ref does-not". Jobs and clients already leave
    // this to the resolver below, which asks the record for its real number and
    // shows nothing when there is no record to ask.
    return { title: "Sale Details" };
  }
  if (pathname === "/finance") return { title: "Finance Hub" };
  if (pathname === "/sales") return { title: "Sales" };
  if (pathname === "/service") return { title: "Service Hub" };

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
  const meta = pageMeta(pathname);
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
