/**
 * /more — Full-screen mobile navigation hub.
 * Replaces the old bottom-sheet drawer. Opens like a native screen.
 * Desktop: renders the same content but inside the normal sidebar layout.
 */
import Link from "next/link";

import { can } from "@/lib/permissions";
import { requireOrgSession } from "@/lib/org-context";
import { getOrgModules } from "@/lib/module-access";
import { routeLabel } from "@/lib/nav/registry";

// ── Section icon helper ────────────────────────────────────────────────────────

function ItemIcon({ d, color }: { d: string | string[]; color: string }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      className={color} aria-hidden="true">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

// ── Row item ──────────────────────────────────────────────────────────────────

function NavRow({
  href,
  icon: _icon,
  label,
  badge,
  iconBg: _iconBg,
  description: _desc,
}: {
  href: string;
  icon?: React.ReactNode; // no longer rendered — kept so call sites don't change
  /** Defaults to the canonical route registry label — avoid overriding. */
  label?: string;
  badge?: number;
  iconBg?: string;
  description?: string; // kept for backward compat but not rendered — keeps UI clean
}) {
  const text = label ?? routeLabel(href);
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-[var(--panel-strong)]"
    >
      {/* Text-forward executive row — no per-item icons. */}
      <p className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-[var(--ink)]">{text}</p>

      {/* Badge */}
      {badge && badge > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[12px] font-black text-black">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}

      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0 text-[var(--ink-muted)]/30" aria-hidden="true">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </Link>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="px-4 pb-1 pt-4 text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/60">
      {title}
    </p>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MorePage() {
  const { user, orgId } = await requireOrgSession();
  const perm = { role: user.role, permissions: user.permissions ?? [] };
  const mods = await getOrgModules(orgId);
  const ok = (key: string) => !key || mods.has(key as never);

  // Derive app version from package.json
  const APP_VERSION = "2.6.0";

  return (
    <div className="pb-6">

      {/* ── BUSINESS ────────────────────────────────────────────────── */}
      <SectionHeader title="Business" />
      <div className="divide-y divide-[var(--line)]/50 rounded-2xl border border-[var(--line)] bg-[var(--panel)] mx-2 overflow-hidden">

        {can.viewIntake(perm) && (
          <NavRow href="/intake" iconBg="bg-[var(--panel-strong)]"
            description="Receive devices and log new repairs"
            icon={<ItemIcon d={["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"]} color="text-[var(--ink-muted)]" />}
          />
        )}

        {can.viewClientInfo(perm) && (
          <NavRow href="/clients" iconBg="bg-[var(--panel-strong)]"
            description="Client directory and history"
            icon={<ItemIcon d={["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","M22 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"]} color="text-[var(--ink-muted)]" />}
          />
        )}

        {["ADMIN","OPS","TECHNICIAN_INTERNAL","MANAGER"].includes(user.role) && ok("INVENTORY") && (
          <NavRow href="/inventory" iconBg="bg-[var(--panel-strong)]"
            description="Parts, stock levels and reorders"
            icon={<ItemIcon d={["M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z","M3.27 6.96 12 12.01l8.73-5.05","M12 22.08V12"]} color="text-[var(--ink-muted)]" />}
          />
        )}

        {user.role !== "TECHNICIAN_EXTERNAL" && (
          <NavRow href="/technicians" iconBg="bg-[var(--panel-strong)]"
            description="Job board and tech performance"
            icon={<ItemIcon d={["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"]} color="text-[var(--ink-muted)]" />}
          />
        )}

        {["ADMIN","OPS","MANAGER"].includes(user.role) && (
          <NavRow href="/inventory/suppliers" iconBg="bg-[var(--panel-strong)]"
            description="Supplier directory and bills"
            icon={<ItemIcon d={["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z","M3.27 6.96 12 12.01l8.73-5.05","M12 22.08V12"]} color="text-[var(--ink-muted)]" />}
          />
        )}

        {ok("COMPLAINTS") && ["ADMIN","MANAGER","TECH_MANAGER","OPS"].includes(user.role) && (
          <NavRow href="/complaints" iconBg="bg-[var(--panel-strong)]"
            description="Track and resolve client issues"
            icon={<ItemIcon d={["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z","M12 9v4","M12 17h.01"]} color="text-[var(--ink-muted)]" />}
          />
        )}

        {can.createLeads(perm) && ok("SALES") && (
          <NavRow href="/sales" iconBg="bg-[var(--panel-strong)]"
            description="Pipeline, campaigns and targets"
            icon={<ItemIcon d={["M22 12h-4l-3 9L9 3l-3 9H2"]} color="text-[var(--ink-muted)]" />}
          />
        )}

        {can.manageFieldVisits(perm) && ok("FIELD") && (
          <NavRow href="/field" iconBg="bg-[var(--panel-strong)]"
            description="Field visits and signoffs"
            icon={<ItemIcon d={["M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z","M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"]} color="text-[var(--ink-muted)]" />}
          />
        )}

      </div>

      {/* ── DOCUMENTS ───────────────────────────────────────────────── */}
      {can.viewFinancials(perm) && (
        <>
          <SectionHeader title="Documents" />
          <div className="divide-y divide-[var(--line)]/50 rounded-2xl border border-[var(--line)] bg-[var(--panel)] mx-2 overflow-hidden">

            {ok("INVOICING") && (
              <>
                <NavRow href="/documents/job-cards" iconBg="bg-[var(--panel-strong)]"
                  icon={<ItemIcon d={["M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2","M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2","M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2","M9 14l2 2 4-4"]} color="text-[var(--ink-muted)]" />}
                />
                <NavRow href="/documents/quotations" iconBg="bg-[var(--panel-strong)]"
                  icon={<ItemIcon d={["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M10 13h4","M8 17h8","M8 9h2"]} color="text-[var(--ink-muted)]" />}
                />
                <NavRow href="/documents/invoices" iconBg="bg-[var(--panel-strong)]"
                  icon={<ItemIcon d={["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"]} color="text-[var(--ink-muted)]" />}
                />
                <NavRow href="/documents/receipts" iconBg="bg-[var(--panel-strong)]"
                  icon={<ItemIcon d={["M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z","M9 12h6","M9 16h4"]} color="text-[var(--ink-muted)]" />}
                />
                <NavRow href="/documents/delivery-notes" iconBg="bg-[var(--panel-strong)]"
                  icon={<ItemIcon d={["M1 3h15v13H1z","M16 8h4l3 3v5h-7V8z"]} color="text-[var(--ink-muted)]" />}
                />
                <NavRow href="/documents/credit-notes" iconBg="bg-[var(--panel-strong)]"
                  icon={<ItemIcon d={["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M8 13h8","M8 17h5","M8 9h2"]} color="text-[var(--ink-muted)]" />}
                />
                <NavRow href="/documents/refunds" iconBg="bg-[var(--panel-strong)]"
                  icon={<ItemIcon d={["M12 2v20","M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6","M6 12h12"]} color="text-[var(--ink-muted)]" />}
                />
              </>
            )}

          </div>
        </>
      )}

      {/* ── POS ──────────────────────────────────────────────────────── */}
      {["ADMIN","OPS","FRONT_DESK","MANAGER"].includes(user.role) && ok("POS") && (
        <>
          <SectionHeader title="Sales" />
          <div className="divide-y divide-[var(--line)]/50 rounded-2xl border border-[var(--line)] bg-[var(--panel)] mx-2 overflow-hidden">
            <NavRow href="/pos" iconBg="bg-[var(--panel-strong)]"
              description="Walk-in sales and product checkout"
              icon={<ItemIcon d={["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z","M3 6h18","M16 10a4 4 0 0 1-8 0"]} color="text-[var(--ink-muted)]" />}
            />
            {["ADMIN","OPS","FRONT_DESK","MANAGER"].includes(user.role) && (
              <NavRow href="/pos/shifts" iconBg="bg-[var(--panel-strong)]"
                description="Daily shift summaries"
                icon={<ItemIcon d={["M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z","M12 6v6l4 2"]} color="text-[var(--ink-muted)]" />}
              />
            )}
          </div>
        </>
      )}

      {/* ── ADMINISTRATION ───────────────────────────────────────────── */}
      {["ADMIN","MANAGER"].includes(user.role) && (
        <>
          <SectionHeader title="Administration" />
          <div className="divide-y divide-[var(--line)]/50 rounded-2xl border border-[var(--line)] bg-[var(--panel)] mx-2 overflow-hidden">

            {can.manageUsers(perm) && (
              <NavRow href="/settings/users" iconBg="bg-[var(--panel-strong)]"
                description="Manage team access and permissions"
                icon={<ItemIcon d={["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75","M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]} color="text-[var(--ink-muted)]" />}
              />
            )}

            {["ADMIN","MANAGER"].includes(user.role) && (
              <NavRow href="/settings/branches" iconBg="bg-[var(--panel-strong)]"
                description="Locations and branch settings"
                icon={<ItemIcon d={["M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9a1.5 1.5 0 0 0 3 0v-9A1.5 1.5 0 0 0 9.5 6ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 10Z"]} color="text-[var(--ink-muted)]" />}
              />
            )}

            {can.viewAccountsSummary(perm) && (
              <NavRow href="/reports" iconBg="bg-[var(--panel-strong)]"
                description="Analytics, KPIs and performance"
                icon={<ItemIcon d={["M3 3v18h18","m19 9-5 5-4-4-3 3"]} color="text-[var(--ink-muted)]" />}
              />
            )}

            {can.viewAccountsSummary(perm) && (
              <NavRow href="/ai-insights" iconBg="bg-[var(--panel-strong)]"
                description="Business copilot and operational intelligence"
                icon={<ItemIcon d={["M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 0 2h-1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1H1a1 1 0 0 1 0-2h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z","M7.5 13.5c.83 0 1.5-.67 1.5-1.5S8.33 10.5 7.5 10.5 6 11.17 6 12s.67 1.5 1.5 1.5z","M16.5 13.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S15 11.17 15 12s.67 1.5 1.5 1.5z"]} color="text-[var(--ink-muted)]" />}
              />
            )}

            <NavRow href="/settings"
              description="Branding, notifications, billing"
              icon={<ItemIcon d={["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z","M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"]} color="text-[var(--ink-muted)]" />}
            />

            {["ADMIN"].includes(user.role) && (
              <NavRow href="/settings/data-heal" iconBg="bg-[var(--panel-strong)]"
                description="Database diagnostics and repair"
                icon={<ItemIcon d={["M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z","M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"]} color="text-[var(--ink-muted)]" />}
              />
            )}

          </div>
        </>
      )}

      {/* ── SUPPORT ──────────────────────────────────────────────────── */}
      <SectionHeader title="Support" />
      <div className="divide-y divide-[var(--line)]/50 rounded-2xl border border-[var(--line)] bg-[var(--panel)] mx-2 overflow-hidden">
        <NavRow href="/settings/notifications" iconBg="bg-[var(--panel-strong)]"
          description="Alert preferences and delivery"
          icon={<ItemIcon d={["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9","M10.3 21a1.94 1.94 0 0 0 3.4 0"]} color="text-[var(--ink-muted)]" />}
        />
        <NavRow href="/settings/profile" iconBg="bg-[var(--panel-strong)]"
          description="Account details and password"
          icon={<ItemIcon d={["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"]} color="text-[var(--ink-muted)]" />}
        />
      </div>

      {/* ── App version ──────────────────────────────────────────────── */}
      <p className="mt-6 px-4 text-center text-[12px] text-[var(--ink-muted)]/40">
        Duuka ProMax v{APP_VERSION}
      </p>

    </div>
  );
}
