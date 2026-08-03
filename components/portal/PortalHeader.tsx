import Link from "next/link";

import { portalLogoutAction } from "@/app/(portal)/portal/actions";

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: "Organization Administrator",
  IT_OFFICER: "IT Officer",
  MEMBER: "Member",
};

export function PortalHeader({
  orgName,
  userName,
  role,
  company,
  active,
}: {
  orgName: string;
  userName: string;
  role: string;
  company: string;
  active?: "dashboard" | "repairs" | "documents";
}) {
  const link = (href: string, label: string, key: "dashboard" | "repairs" | "documents") => (
    <Link
      href={href}
      className={`rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition ${
        active === key ? "bg-[var(--panel-strong)] text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">{orgName} · Client Portal</p>
        <p className="text-[13px] text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--ink)]">{userName}</span> · {company} · {ROLE_LABEL[role] ?? role}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {link("/portal/dashboard", "Dashboard", "dashboard")}
        {link("/portal/repairs", "Repairs", "repairs")}
        {link("/portal/documents", "Documents", "documents")}
        <form action={portalLogoutAction}>
          <button type="submit" className="ml-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] font-semibold hover:bg-[var(--panel-strong)]">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
