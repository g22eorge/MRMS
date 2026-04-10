"use client";

import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
    if (role === "INTAKE") {
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
    return { title: "Edit Job", subtitle: `Ref ${parts[1].slice(0, 8)}`, description: "Update job details and technician notes." };
  }
  if (parts[0] === "jobs" && parts[1]) {
    return { title: "Job Details", subtitle: `Ref ${parts[1].slice(0, 8)}`, description: "Review status, diagnosis, repair log, financials, and timeline." };
  }
  if (pathname === "/clients") return { title: "Clients", description: "Directory, engagement level, and quick access to client history." };
  if (parts[0] === "clients" && parts[1]) {
    return { title: "Client Details", subtitle: `Ref ${parts[1].slice(0, 8)}`, description: "View client profile, job history, and notes timeline." };
  }
  if (pathname === "/reports") return { title: "Reports", description: "Operational and financial insights for repair performance." };
  if (pathname === "/technicians") return { title: "Technician Portal", description: "Prioritized queue for assigned repair work." };
  if (pathname === "/technicians/payouts") return { title: "Technician Payouts", description: "Track paid and unpaid fees across your external assignments." };
  if (pathname === "/settings/users") return { title: "User Management", description: "Create users, assign roles, and manage active access." };
  if (pathname === "/settings/branding") return { title: "Branding", description: "Manage invoice logo and visual branding assets." };
  if (pathname === "/settings/profile") return { title: "Profile", description: "Update your personal account details and contact info." };
  return { title: "Workspace" };
}

async function fetchJobNumber(id: string) {
  const res = await fetch(`/api/meta/job/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { jobNumber?: string };
  return data.jobNumber ?? null;
}

async function fetchClientName(id: string) {
  const res = await fetch(`/api/meta/client/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { fullName?: string };
  return data.fullName ?? null;
}

function roleTag(role: Role) {
  if (role === "ADMIN") return "Admin";
  if (role === "TECHNICIAN_INTERNAL") return "Internal Tech";
  if (role === "TECHNICIAN_EXTERNAL") return "External Tech";
  if (role === "OPS") return "Operations";
  if (role === "INTAKE") return "Intake";
  return "Operations";
}

export function PageThemeHeader({ role }: { role: Role }) {
  const pathname = usePathname();
  const meta = pageMeta(pathname, role);
  const [resolvedSubtitle, setResolvedSubtitle] = useState<{ path: string; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const parts = pathname.split("/").filter(Boolean);

    const load = async () => {
      if (parts[0] === "jobs" && parts[1]) {
        const jobNumber = await fetchJobNumber(parts[1]);
        if (!cancelled && jobNumber) {
          setResolvedSubtitle({ path: pathname, text: jobNumber });
        }
        return;
      }
      if (parts[0] === "clients" && parts[1]) {
        const clientName = await fetchClientName(parts[1]);
        if (!cancelled && clientName) {
          setResolvedSubtitle({ path: pathname, text: clientName });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const subtitle = resolvedSubtitle?.path === pathname ? resolvedSubtitle.text : meta.subtitle;

  return (
    <section className="panel-shadow rounded-2xl border border-[var(--line)] bg-[linear-gradient(120deg,#000000_0%,#222222_52%,#333333_100%)] p-4 text-white md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">{roleTag(role)} Workspace</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{meta.title}</h1>
          {subtitle ? <p className="mt-1 truncate text-xs text-white/75">{subtitle}</p> : null}
        </div>
        <span className="rounded-full border border-white/25 bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/85">
          Live
        </span>
      </div>
      {meta.description ? <p className="mt-2 max-w-3xl text-sm text-white/85">{meta.description}</p> : null}
    </section>
  );
}
