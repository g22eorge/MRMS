import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { RepairRequestForm } from "@/components/public/RepairRequestForm";
import { AppLogoDark } from "@/components/ui/AppLogo";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  if (host.startsWith("app.eagleinfosolutions.com")) {
    return {
      title: "Duuka ProMax — Business Management Software",
      description:
        "Duuka ProMax is a complete business management platform for any business — sales, POS, inventory, finance, documents, CRM, service jobs, and communications in one place.",
      alternates: { canonical: "/" },
    };
  }

  return {
    title: "Eagle Info Solutions — Device Repair & Business Management",
    description:
      "Submit a device repair request online. Eagle Info Solutions repairs phones, laptops and tablets in Kampala — written quote, no-fix-no-fee, 30-day warranty. Powered by Duuka ProMax.",
    alternates: { canonical: "/" },
  };
}

// ── Module definitions ─────────────────────────────────────────────────────────
// One neutral card style across the board — the palette is intentionally
// black/white with a single gold accent, so nothing reads as a rainbow demo.

const MODULES = [
  {
    group: "Service & Repairs",
    blurb: "Every job tracked from intake to handover.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    items: ["Jobs & Repair Tracking", "Intake & Reception", "Field Visits", "Technician Management", "Complaints Handling"],
  },
  {
    group: "Stock & Supply",
    blurb: "Know what you hold and what to reorder.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
      </svg>
    ),
    items: ["Inventory Item Levels", "Purchase Orders", "Goods Received", "Supplier Bills", "Stock Counts & Transfers"],
  },
  {
    group: "Customers & Sales",
    blurb: "Sell, chase leads, and keep clients close.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    items: ["Client Directory", "Point of Sale (POS)", "Sales CRM & Leads", "Sales Visits", "Campaigns & Outreach"],
  },
  {
    group: "Documents",
    blurb: "Branded quotes, invoices, and receipts.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
    items: ["Job Cards", "Invoices & Receipts", "Quotations", "Delivery Notes", "Credit Notes & Refunds"],
  },
  {
    group: "Finance",
    blurb: "See profit, cash, and who owes you.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    items: ["Expenses & Bank", "P&L, Balance Sheet", "Cash Flow Statements", "Aged Receivables"],
  },
  {
    group: "Reports & Analytics",
    blurb: "Turn daily activity into decisions.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
    items: ["Tech Performance", "Operations Dashboard", "Inventory Value Report", "Customer Statements", "Revenue Analytics"],
  },
  {
    group: "Communications",
    blurb: "Reach clients on WhatsApp automatically.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      </svg>
    ),
    items: ["WhatsApp Notifications", "Message Templates", "Meta Business Integration", "Delivery Outbox", "Status Alerts"],
  },
  {
    group: "Client Portal",
    blurb: "Your customers track repairs and get updates themselves.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M3 8h18" />
        <circle cx="12" cy="12.4" r="1.6" />
        <path d="M9.2 15.8a2.8 2.8 0 0 1 5.6 0" />
      </svg>
    ),
    items: ["Live Repair Tracking", "Online Repair Requests", "Receipts & Documents", "Status Notifications", "Secure Client Login"],
  },
  {
    group: "Security & Admin",
    blurb: "Right access per role, fully audited.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    ),
    items: ["9 Role-Based Access Levels", "Full Audit Trail", "User Management", "Data Heal & Diagnostics"],
  },
];

const STATS = [
  { value: "9", label: "Modules" },
  { value: "9", label: "User Roles" },
  { value: "50+", label: "Features" },
  { value: "Cloud", label: "Hosted" },
];

// ── Pricing — mirrors the in-app billing plans (lib/pesapal, lib/plan-limits) ──
// Display names use the branded Duuka ladder; internal billing keys stay
// STARTER/STANDARD/GROWTH/PREMIUM/ENTERPRISE. Keep amounts in sync with
// PLAN_PRICES / PLAN_LIMITS if billing changes.
const PRICING: Array<{
  name: string;
  price: string | null;
  tagline: string;
  inherits?: string;
  features: string[];
  popular?: boolean;
  cta: string;
  href: string;
  external?: boolean;
}> = [
  {
    name: "Duuka",
    price: null,
    tagline: "Everything to get started",
    cta: "Start free",
    href: "/register",
    features: ["2 team members", "20 jobs / month", "20 inventory items", "1 branch"],
  },
  {
    name: "Duuka Plus",
    price: "35,000",
    tagline: "For a growing shop",
    inherits: "Duuka",
    cta: "Get started",
    href: "/register",
    features: ["5 team members", "100 jobs / month", "100 inventory items", "Team invite links"],
  },
  {
    name: "Duuka Pro",
    price: "75,000",
    tagline: "Best for most teams",
    inherits: "Duuka Plus",
    popular: true,
    cta: "Get started",
    href: "/register",
    features: ["15 team members", "500 jobs / month", "3 branches", "Custom branding"],
  },
  {
    name: "Duuka Max",
    price: "120,000",
    tagline: "For busy operations",
    inherits: "Duuka Pro",
    cta: "Get started",
    href: "/register",
    features: ["30 team members", "2,000 jobs / month", "1,000 inventory items", "8 branches"],
  },
  {
    name: "Duuka ProMax",
    price: "200,000",
    tagline: "Unlimited scale",
    inherits: "Duuka Max",
    cta: "Talk to sales",
    href: "https://wa.me/256772006344?text=Hi%2C%20I%27m%20interested%20in%20the%20Duuka%20ProMax%20plan.",
    external: true,
    features: ["Unlimited team & jobs", "Unlimited inventory", "Unlimited branches", "Priority support"],
  },
];

// WhatsApp SVG path shared across multiple links
const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

// Small check glyph for pricing feature lists
function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C9A227]/70" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// ── Shared pricing block — used on both the SaaS landing and the Eagle page ──
function PricingPlans() {
  return (
    <div>
      <div className="mb-9 max-w-2xl">
        <p className="text-[0.8125rem] font-bold uppercase tracking-[0.18em] text-[#C9A227]">Pricing</p>
        <h2 className="mt-2 text-2xl font-extrabold text-white md:text-3xl">One system. A plan for every size.</h2>
        <p className="mt-3 text-sm leading-6 text-white/55">
          Start on <span className="font-semibold text-white/75">Duuka</span> free — no card needed. Move up only when you
          outgrow it. Amounts in UGX per month.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-stretch">
        {PRICING.map((p) => (
          <div
            key={p.name}
            className={`group relative flex flex-col rounded-2xl border p-5 transition duration-200 ${
              p.popular
                ? "border-[#C9A227]/45 bg-gradient-to-b from-[#C9A227]/[0.11] to-[#C9A227]/[0.02] shadow-[0_24px_60px_-24px_rgba(201, 162, 39,0.55)] lg:z-10 lg:scale-[1.04]"
                : "border-white/10 bg-white/[0.02] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.04]"
            }`}
          >
            {p.popular && (
              <span
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-black"
                style={{ background: "linear-gradient(180deg,#DEBD54 0%,#C9A020 100%)" }}
              >
                Most popular
              </span>
            )}

            <p className={`text-[0.8125rem] font-bold uppercase tracking-wide ${p.popular ? "text-[#DEBD54]" : "text-white/75"}`}>
              {p.name}
            </p>
            <p className="mt-1 text-[0.75rem] leading-snug text-white/55">{p.tagline}</p>

            <div className="mt-4 flex items-baseline gap-1">
              {p.price === null ? (
                <span className="text-[1.75rem] font-black tracking-tight text-white">Free</span>
              ) : (
                <>
                  <span className="text-[0.8125rem] font-medium text-white/55">UGX</span>
                  <span className="text-[1.75rem] font-black tabular-nums tracking-tight text-white">{p.price}</span>
                  <span className="text-[0.75rem] text-white/55">/mo</span>
                </>
              )}
            </div>

            <div className="my-4 h-px bg-white/8" />

            {p.inherits && (
              <p className="mb-2 text-[0.75rem] leading-snug text-white/55">
                Everything in <span className="font-semibold text-white/70">{p.inherits}</span>, plus:
              </p>
            )}
            <ul className="space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-[0.75rem] leading-snug text-white/65">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-6">
              {p.external ? (
                <a
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-[0.8125rem] font-semibold text-white/75 transition active:scale-[0.98] hover:border-[#C9A227]/40 hover:text-white"
                >
                  {p.cta}
                </a>
              ) : (
                <Link
                  href={p.href}
                  className={`block rounded-xl px-4 py-2.5 text-center text-[0.8125rem] font-bold transition active:scale-[0.98] ${
                    p.popular
                      ? "text-black shadow-[0_4px_20px_rgba(201, 162, 39,0.3)] hover:opacity-90"
                      : "border border-white/15 bg-white/5 text-white/75 hover:border-[#C9A227]/40 hover:text-white"
                  }`}
                  style={p.popular ? { background: "linear-gradient(180deg,#DEBD54 0%,#C9A020 100%)" } : undefined}
                >
                  {p.cta}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[0.75rem] text-white/55">
        Every plan includes the core system. Higher plans raise your limits and unlock extras like more branches and custom
        branding. Cancel anytime.
      </p>
    </div>
  );
}

function DuukaSaasLanding() {
  return (
    <main className="theme-blackgold relative min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-[#C9A227]/8 blur-[150px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-white/6 bg-[#050505]/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogoDark height={44} priority />
          </div>
          <div className="flex items-center gap-2">
            <Link href="/register" className="hidden rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-4 py-2 text-xs font-semibold text-[#C9A227] transition active:scale-[0.98] hover:bg-[#C9A227]/20 sm:inline-flex">
              Start Free
            </Link>
            <Link href="/login" className="rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition active:scale-[0.98] hover:border-white/20 hover:text-white">
              Login
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#C9A227]/25 bg-[#C9A227]/8 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C9A227]" />
            <span className="text-[0.8125rem] font-bold uppercase tracking-[0.18em] text-[#C9A227]">One system for your whole business</span>
          </div>
          <h1 className="display-serif max-w-2xl text-4xl leading-[0.95] tracking-tight text-white md:text-6xl">
            Run everything from
            <span className="block bg-gradient-to-r from-[#DEBD54] to-[#C9A020] bg-clip-text text-transparent">one workspace.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-7 text-white/60">
            Sell, stock, invoice, and get paid — everything your business does, in one place.
          </p>
          {/* Scannable chips instead of a wall of text — skim in 2 seconds. */}
          <div className="mt-5 flex flex-wrap gap-2">
            {["POS", "Inventory", "Repairs", "CRM", "Invoicing", "Finance", "Comms"].map((c) => (
              <span key={c} className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[0.8125rem] font-medium text-white/65">{c}</span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl px-6 py-3 text-sm font-bold text-black shadow-[0_4px_20px_rgba(201, 162, 39,0.3)] transition hover:opacity-90 active:scale-[0.98]" style={{ background: "linear-gradient(180deg,#DEBD54 0%,#C9A020 100%)" }}>
              Create Workspace
            </Link>
            <a href="https://wa.me/256772006344?text=Hi%2C%20I%27m%20interested%20in%20Duuka%20ProMax.%20Please%20send%20pricing%20and%20setup%20details." target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 transition active:scale-[0.98] hover:border-[#C9A227]/30 hover:text-white">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden><path d={WA_PATH}/></svg>
              Talk to Sales
            </a>
          </div>
          <p className="mt-5 text-[0.8125rem] text-white/55">
            Built for retail shops, service centres, wholesalers, clinics, workshops — any team that sells, stocks, or serves.
          </p>
        </div>

        {/* Product mock — a live-looking ops dashboard so visitors see the system,
            not another paragraph. */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-3 shadow-2xl sm:p-4">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#C9A227]/12 blur-[70px]" />
          <div className="relative rounded-2xl border border-white/8 bg-[#0b0b0b] p-4">

            {/* Window chrome */}
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#DEBD54]" />
                <p className="text-[0.75rem] font-bold text-white">Operations Dashboard</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
              </span>
            </div>

            {/* KPI tiles */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { v: "UGX 4.2M", l: "Revenue · mo", d: "▲ 12%", tone: "text-[#DEBD54]" },
                { v: "18", l: "Open orders", d: "3 due today", tone: "text-white/55" },
                { v: "UGX 1.1M", l: "Receivable", d: "7 invoices", tone: "text-white/55" },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-[0.9375rem] font-extrabold text-white">{k.v}</p>
                  <p className="mt-0.5 text-[0.625rem] text-white/55">{k.l}</p>
                  <p className={`mt-1 text-[0.625rem] font-semibold ${k.tone}`}>{k.d}</p>
                </div>
              ))}
            </div>

            {/* Revenue chart */}
            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[0.6875rem] font-semibold text-white/50">Revenue · last 7 days</p>
                <p className="text-[0.6875rem] font-bold text-[#DEBD54]">▲ 12%</p>
              </div>
              <svg viewBox="0 0 240 64" className="mt-2 w-full" role="img" aria-label="Revenue trend chart">
                <defs>
                  <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#DEBD54" />
                    <stop offset="1" stopColor="#C9A020" stopOpacity="0.5" />
                  </linearGradient>
                </defs>
                {[26, 34, 22, 44, 38, 52, 60].map((h, i) => (
                  <rect key={i} x={6 + i * 34} y={64 - h} width="20" height={h} rx="3" fill="url(#barGold)" opacity={i === 6 ? 1 : 0.85} />
                ))}
              </svg>
            </div>

            {/* Needs attention feed */}
            <div className="mt-3">
              <p className="mb-1.5 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-white/55">Needs attention</p>
              <div className="space-y-1.5">
                {[
                  { dot: "bg-red-400/70", t: "Invoice #INV-000482 overdue", s: "2 days" },
                  { dot: "bg-white/30", t: "5 items below reorder level", s: "restock" },
                  { dot: "bg-[#DEBD54]", t: "7 invoices ready to chase", s: "UGX 1.1M" },
                ].map((r) => (
                  <div key={r.t} className="flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.dot}`} />
                    <p className="flex-1 truncate text-[0.6875rem] text-white/70">{r.t}</p>
                    <p className="text-[0.6875rem] font-semibold text-white/55">{r.s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust / reliability band — honest signals, no invented metrics ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
            {[
              { v: "99.9%", l: "Uptime target", d: "Always-on cloud hosting" },
              { v: "Encrypted", l: "Data & connections", d: "Private by default" },
              { v: "Backups", l: "Automatic", d: "Your work stays safe" },
              { v: "Audit trail", l: "Every action logged", d: "9 role-based access levels" },
            ].map((t) => (
              <div key={t.l} className="text-center sm:text-left">
                <p className="text-xl font-black tracking-tight text-[#DEBD54] sm:text-2xl">{t.v}</p>
                <p className="mt-1 text-[0.8125rem] font-semibold text-white/80">{t.l}</p>
                <p className="mt-0.5 text-[0.75rem] leading-snug text-white/55">{t.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[0.6875rem] leading-snug text-white/55">
            Runs on managed cloud infrastructure with automatic backups and encrypted connections. Uptime shown is our
            target service availability.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-8 max-w-2xl">
          <p className="text-[0.8125rem] font-bold uppercase tracking-[0.18em] text-[#C9A227]">Product Suite</p>
          <h2 className="mt-2 text-2xl font-extrabold text-white md:text-3xl">Everything your business needs to operate daily</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">Start with the modules you need, then expand into full operations, finance, reporting, and communications.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod) => (
            <div key={mod.group} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#C9A227]/30 hover:bg-white/[0.04]">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#C9A227]/20 bg-[#C9A227]/[0.06] text-[#C9A227] transition group-hover:border-[#C9A227]/35">{mod.icon}</div>
              <p className="text-sm font-bold text-white">{mod.group}</p>
              <p className="mt-1.5 text-[0.8125rem] leading-snug text-white/55">{mod.blurb}</p>
              <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-white/55">{mod.items.length} tools</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mobile app ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Phone mock */}
          <div className="order-2 flex justify-center lg:order-1">
            <div className="relative w-[236px]">
              <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-[#C9A227]/10 blur-[60px]" />
              <div className="relative rounded-[2.3rem] border border-white/12 bg-[#0b0b0b] p-2.5 shadow-2xl">
                <div className="overflow-hidden rounded-[1.8rem] border border-white/8 bg-[#0d0d0d]">
                  {/* status row */}
                  <div className="flex items-center justify-between px-4 pb-2 pt-3">
                    <span className="text-[0.625rem] font-medium text-white/55">9:41</span>
                    <span className="h-1.5 w-14 rounded-full bg-white/8" />
                    <span className="text-[0.625rem] font-medium text-white/55">Duuka</span>
                  </div>
                  <div className="px-3 pb-4">
                    <div className="flex items-center justify-between border-b border-white/8 pb-2">
                      <p className="text-[0.75rem] font-bold text-white">Dashboard</p>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wide text-emerald-300">
                        <span className="h-1 w-1 rounded-full bg-emerald-400" /> Live
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                        <p className="text-[0.8125rem] font-extrabold text-white">UGX 4.2M</p>
                        <p className="mt-0.5 text-[0.5rem] text-white/55">Revenue · mo</p>
                      </div>
                      <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                        <p className="text-[0.8125rem] font-extrabold text-[#DEBD54]">▲ 12%</p>
                        <p className="mt-0.5 text-[0.5rem] text-white/55">vs last month</p>
                      </div>
                    </div>
                    <div className="mt-1.5 rounded-lg border border-white/8 bg-white/[0.02] p-2">
                      <p className="mb-1 text-[0.5rem] font-semibold text-white/55">Last 7 days</p>
                      <svg viewBox="0 0 200 40" className="w-full" role="img" aria-label="Sales trend">
                        {[14, 20, 12, 26, 22, 30, 36].map((h, i) => (
                          <rect key={i} x={4 + i * 28} y={40 - h} width="16" height={h} rx="2" fill="#DEBD54" opacity={i === 6 ? 1 : 0.8} />
                        ))}
                      </svg>
                    </div>
                    <div className="mt-2 rounded-lg py-1.5 text-center text-[0.625rem] font-bold text-black" style={{ background: "linear-gradient(180deg,#DEBD54 0%,#C9A020 100%)" }}>
                      + New sale
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div className="order-1 lg:order-2">
            <p className="text-[0.8125rem] font-bold uppercase tracking-[0.18em] text-[#C9A227]">Mobile</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white md:text-3xl">Run your business from your pocket</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/50">
              Works on any Android or iOS device — sell, invoice, and check your numbers on the go. Everything syncs in
              real time, so the shop and the field always see the same figures.
            </p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {[
                "Works on any Android or iOS device",
                "Record a sale in seconds",
                "Create invoices & receipts on the go",
                "Real-time sync — no exports",
              ].map((f) => (
                <li key={f} className="flex gap-2 text-[0.8125rem] leading-snug text-white/65">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/register" className="rounded-xl px-6 py-3 text-sm font-bold text-black shadow-[0_4px_20px_rgba(201, 162, 39,0.3)] transition hover:opacity-90 active:scale-[0.98]" style={{ background: "linear-gradient(180deg,#DEBD54 0%,#C9A020 100%)" }}>
                Start free
              </Link>
              <span className="text-[0.75rem] text-white/55">Install straight from your phone&apos;s browser — no download needed.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Client Portal ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Copy */}
          <div>
            <p className="text-[0.8125rem] font-bold uppercase tracking-[0.18em] text-[#C9A227]">Client Portal</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white md:text-3xl">Give your customers their own window</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/50">
              Every client gets a secure login to track their repairs live, submit new requests, and download their
              receipts and invoices — so your team fields fewer &ldquo;is it ready yet?&rdquo; calls.
            </p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {[
                "Live repair status tracking",
                "Submit repair requests online",
                "Receipts, invoices & quotes",
                "Automatic status updates",
              ].map((f) => (
                <li key={f} className="flex gap-2 text-[0.8125rem] leading-snug text-white/65">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/register" className="rounded-xl px-6 py-3 text-sm font-bold text-black shadow-[0_4px_20px_rgba(201, 162, 39,0.3)] transition hover:opacity-90 active:scale-[0.98]" style={{ background: "linear-gradient(180deg,#DEBD54 0%,#C9A020 100%)" }}>
                Start free
              </Link>
              <span className="text-[0.75rem] text-white/55">Your customers sign in from any browser — nothing to install.</span>
            </div>
          </div>

          {/* Portal mock — a client tracking their repair */}
          <div className="relative">
            <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[#C9A227]/10 blur-[70px]" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-2xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-1.5 border-b border-white/8 px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="ml-2 truncate rounded-md bg-white/5 px-2.5 py-1 text-[0.5rem] text-white/40">care.eagleinfosolutions.com/portal</span>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.5rem] font-bold uppercase tracking-[0.16em] text-[#C9A227]">Client Portal</p>
                    <p className="text-[0.8125rem] font-bold text-white">Welcome back, Sarah</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[0.5rem] font-bold uppercase tracking-wide text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready for pickup
                  </span>
                </div>

                {/* Repair card with status timeline */}
                <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.6875rem] font-bold text-white">iPhone 13 · Screen repair</p>
                    <p className="text-[0.5rem] text-white/40">EIS-3/2025/0042</p>
                  </div>
                  <div className="relative mt-3.5">
                    <div className="absolute inset-x-1.5 top-[5px] h-0.5 rounded-full bg-[#DEBD54]/60" />
                    <div className="relative flex justify-between">
                      {["Received", "Diagnosed", "In repair", "Ready"].map((step) => (
                        <div key={step} className="flex flex-col items-center">
                          <span className="h-3 w-3 rounded-full border-2 border-[#0b0b0b] bg-[#DEBD54]" />
                          <span className="mt-1 text-[0.4375rem] text-white/60">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Documents row */}
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {["Receipt", "Invoice", "Quote"].map((d) => (
                    <div key={d} className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-white/40" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
                      <span className="text-[0.5rem] text-white/60">{d}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-2 rounded-lg py-1.5 text-center text-[0.5rem] font-bold text-black" style={{ background: "linear-gradient(180deg,#DEBD54 0%,#C9A020 100%)" }}>
                  + New repair request
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <PricingPlans />
      </section>

      {/* ── Closing CTA — catches visitors who scrolled the whole page ── */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div
          className="relative overflow-hidden rounded-3xl border border-[#C9A227]/25 p-8 text-center md:p-12"
          style={{
            background: "linear-gradient(135deg,#1f1b0e 0%,#141006 45%,#0c0c0c 100%)",
            boxShadow: "0 0 0 1px rgba(201, 162, 39,0.12), 0 24px 60px rgba(0,0,0,0.5)",
          }}
        >
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-96 -translate-x-1/2 rounded-full bg-[#C9A227]/12 blur-[90px]" />
          <div className="relative">
            <h2 className="text-2xl font-black tracking-tight text-white md:text-4xl">
              Ready to run your business this way?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/55">
              Start free in minutes — or talk to us about setup, migration, and training.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="rounded-xl px-7 py-3 text-sm font-bold text-black shadow-[0_4px_20px_rgba(201, 162, 39,0.3)] transition hover:opacity-90 active:scale-[0.98]" style={{ background: "linear-gradient(180deg,#DEBD54 0%,#C9A020 100%)" }}>
                Create Workspace
              </Link>
              <a href="https://wa.me/256772006344?text=Hi%2C%20I%27m%20interested%20in%20Duuka%20ProMax.%20Please%20send%20pricing%20and%20setup%20details." target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3 text-sm font-semibold text-white/75 transition active:scale-[0.98] hover:border-[#C9A227]/30 hover:text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden><path d={WA_PATH}/></svg>
                Talk to Sales
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function Page() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  const isSaasLanding = host.startsWith("app.eagleinfosolutions.com");

  if (isSaasLanding) return <DuukaSaasLanding />;

  return (
    <main className="theme-blackgold relative min-h-screen overflow-x-hidden bg-[#050505] text-white">

      {/* ── Ambient background ── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#C9A227]/8 blur-[140px]" />
      </div>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-white/6 bg-[#050505]/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">

          {/* Brand — Eagle Info Solutions */}
          <div className="flex items-center gap-2">
            <Image src="/eagle-info-logo.png" alt="Eagle Info Solutions" width={32} height={32} className="h-8 w-8 object-contain" priority />
            <span className="text-sm font-bold text-white">Eagle Info Solutions</span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <a
              href="#repair-form"
              className="hidden items-center gap-1.5 rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-4 py-2 text-xs font-semibold text-[#C9A227] transition active:scale-[0.98] hover:bg-[#C9A227]/20 sm:flex"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              Repair Request
            </a>
            <Link
              href="/feedback"
              className="hidden items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs font-semibold text-red-400/80 transition hover:bg-red-500/15 hover:text-red-400 md:flex"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Complaint
            </Link>
            <a
              href="https://wa.me/256772006344?text=Hi%20Eagle%20Info%2C%20I%20have%20a%20device%20I%20need%20repaired."
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366]/15 border border-[#25D366]/25 px-3 py-2 text-xs font-semibold text-[#25D366] transition active:scale-[0.98] hover:bg-[#25D366]/25"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden><path d={WA_PATH}/></svg>
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <Link
              href="/login"
              className="rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-xs font-semibold text-white/60 transition active:scale-[0.98] hover:border-white/20 hover:text-white"
            >
              Staff Login
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4">

        {/* ══════════════════════════════════════════════════════════════
            HERO — Eagle Info Solutions repair service + inline form
        ══════════════════════════════════════════════════════════════ */}
        <section id="repair-form" className="py-12 md:py-16">

          {/* Two-column: left = copy, right = form */}
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">

            {/* ── Left: Company + service intro ── */}
            <div className="lg:max-w-sm lg:pt-2 lg:sticky lg:top-24">
              {/* Hero illustration — device brought back to life */}
              <svg viewBox="0 0 320 170" className="mb-6 w-full max-w-[320px]" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Device repair illustration">
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#DEBD54" />
                    <stop offset="1" stopColor="#C9A020" />
                  </linearGradient>
                </defs>
                <circle cx="196" cy="86" r="78" fill="#C9A227" opacity="0.10" />
                {/* Laptop */}
                <rect x="18" y="52" width="150" height="92" rx="8" fill="#0b0b0b" stroke="url(#gold)" strokeWidth="2.5" />
                <rect x="30" y="64" width="126" height="68" rx="4" fill="#111" />
                <path d="M40 108 h18 l7 -26 l11 44 l8 -22 h22" stroke="#DEBD54" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="6" y="144" width="174" height="9" rx="4.5" fill="#1a1a1a" stroke="url(#gold)" strokeWidth="1.5" />
                {/* Phone */}
                <rect x="196" y="34" width="74" height="112" rx="14" fill="#0b0b0b" stroke="url(#gold)" strokeWidth="2.5" />
                <rect x="205" y="46" width="56" height="76" rx="4" fill="#111" />
                <path d="M233 96 m-13 0 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0" fill="none" stroke="#DEBD54" strokeWidth="2.5" opacity="0.35" />
                <path d="M226 96 l5 5 l9 -11" stroke="#DEBD54" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="233" cy="134" r="3" fill="url(#gold)" />
                {/* Repair badge — crossed wrench + screwdriver */}
                <circle cx="150" cy="40" r="24" fill="#0b0b0b" stroke="url(#gold)" strokeWidth="2.5" />
                <path d="M141 49 l10 -10 M148 32 a6 6 0 0 1 8 8 l-2 2" stroke="#DEBD54" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M159 49 l-9 -9" stroke="#DEBD54" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <circle cx="143" cy="47" r="2" fill="#DEBD54" />
                {/* Sparkles */}
                <path d="M286 30 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" fill="url(#gold)" opacity="0.8" />
                <circle cx="60" cy="30" r="2.5" fill="#C9A227" opacity="0.6" />
              </svg>

              {/* Company badge */}
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-1.5">
                <Image src="/eagle-info-logo.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" />
                <span className="text-[0.8125rem] font-semibold text-white/60">Eagle Info Solutions</span>
              </div>

              <h1 className="display-serif text-3xl leading-tight text-white xl:text-4xl">
                Device broken?<br />
                <span className="bg-gradient-to-r from-[#DEBD54] to-[#C9A020] bg-clip-text text-transparent">
                  We fix it fast.
                </span>
              </h1>

              <p className="mt-4 text-sm leading-relaxed text-white/50">
                Fill in the form to submit your repair request directly to Eagle Info Solutions.
                We&apos;ll review it and get back to you within a few hours with a quote and timeline.
              </p>

              {/* Proof strip — punchy, from the shop's real guarantees.
                  Swap in a real Google rating / repair count when available. */}
              <div className="mt-6 grid grid-cols-3 gap-2">
                {[
                  { stat: "4.9★", sub: "rated on Google" },
                  { stat: "Free", sub: "written quote" },
                  { stat: "30-day", sub: "repair warranty" },
                ].map((s) => (
                  <div key={s.sub} className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2.5 text-center">
                    <p className="text-base font-extrabold text-[#DEBD54]">{s.stat}</p>
                    <p className="mt-0.5 text-[0.6875rem] leading-tight text-white/55">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Trust badges */}
              <div className="mt-6 space-y-2.5">
                {[
                  {
                    label: "Written quote before any work begins",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
                  },
                  {
                    label: "No fix, no fee — guaranteed",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
                  },
                  {
                    label: "30-day warranty on all repairs",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>,
                  },
                  {
                    label: "Shop L28, Nalubega Complex, Bombo Road, Kampala",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
                  },
                  {
                    label: "Phones · Laptops · Tablets · PCs",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
                  },
                ].map((t) => (
                  <div key={t.label} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-[#C9A227]/60">{t.icon}</span>
                    <p className="text-[0.8125rem] leading-tight text-white/55">{t.label}</p>
                  </div>
                ))}
              </div>

              {/* Alternative contact */}
              <div className="mt-7 flex flex-col gap-2">
                <p className="text-[0.8125rem] font-semibold uppercase tracking-widest text-white/55">Or contact us directly</p>
                <a
                  href="https://wa.me/256772006344?text=Hi%20Eagle%20Info%2C%20I%20have%20a%20device%20I%20need%20repaired.%20Please%20help%20me."
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-[#25D366]/12 border border-[#25D366]/25 px-4 py-2.5 text-sm font-semibold text-[#25D366] transition active:scale-[0.98] hover:bg-[#25D366]/20"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden><path d={WA_PATH}/></svg>
                  +256 772 006 344 on WhatsApp
                </a>
                <a
                  href="/address"
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-white/55 transition hover:border-white/15 hover:text-white/65"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden>
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  Get directions to our shop
                </a>
              </div>
            </div>

            {/* ── Right: The repair request form ── */}
            <div className="flex-1">
              <div
                className="relative overflow-hidden rounded-2xl border border-white/10 p-6 md:p-8"
                style={{
                  background: "linear-gradient(160deg,#111111 0%,#0d0d0d 100%)",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.5)",
                }}
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#C9A227]/6 blur-[60px]" />
                <div className="relative">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-white">Repair Request Form</p>
                      <p className="mt-0.5 text-xs text-white/55">All fields marked * are required</p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[0.75rem] font-semibold text-emerald-400">Live</span>
                    </div>
                  </div>
                  <RepairRequestForm />
                </div>
              </div>
            </div>
          </div>

          {/* ── Complaint CTA strip ── */}
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-red-500/12 bg-red-500/[0.04] px-6 py-5 text-center sm:flex-row sm:text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white/80">Had a bad experience?</p>
              <p className="mt-0.5 text-xs text-white/55">
                We take every complaint seriously. Tell us what went wrong and we&apos;ll make it right.
              </p>
            </div>
            <Link
              href="/feedback"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Submit a Complaint
            </Link>
          </div>
        </section>

        {/* ── Divider with Duuka ProMax intro ── */}
        <div className="relative py-6">
          <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          <div className="relative flex justify-center">
            <div className="flex items-center gap-3 rounded-full border border-white/8 bg-[#050505] px-5 py-2">
              <span className="text-[0.8125rem] text-white/55">Also available as a</span>
              <span className="text-[0.8125rem] font-bold text-[#C9A227]/70">Duuka ProMax</span>
              <span className="text-[0.8125rem] text-white/55">business system</span>
              <a href="#business-system" className="text-[0.8125rem] font-semibold text-[#C9A227]/60 hover:text-[#C9A227] transition-colors">
                Learn more ↓
              </a>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SYSTEM SHOWCASE — Duuka ProMax for business owners
        ══════════════════════════════════════════════════════════════ */}
        <section id="business-system" className="py-12">

          {/* Stats bar */}
          <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/6 bg-white/[0.02] p-4 text-center">
                <p className="text-2xl font-extrabold text-[#C9A227]">{s.value}</p>
                <p className="mt-0.5 text-[0.8125rem] text-white/55">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Heading */}
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#C9A227]/25 bg-[#C9A227]/8 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C9A227]" />
            <span className="text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-[#C9A227]/90">Duuka ProMax — Business Management System</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold text-white md:text-3xl">
            Manage your entire business like a pro
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/55">
            The complete system that runs Eagle Info Solutions. Everything below, in one place:
          </p>

          {/* Module grid */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((mod) => (
              <div
                key={mod.group}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#C9A227]/30 hover:bg-white/[0.04]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#C9A227]/20 bg-[#C9A227]/[0.06] text-[#C9A227] transition group-hover:border-[#C9A227]/35">{mod.icon}</div>
                <p className="text-sm font-bold text-white">{mod.group}</p>
                <p className="mt-1.5 text-[0.8125rem] leading-snug text-white/55">{mod.blurb}</p>
                <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-white/55">{mod.items.length} tools</p>
              </div>
            ))}
          </div>

          {/* ── Pricing ── */}
          <div className="mt-14">
            <PricingPlans />
          </div>

          {/* ── Commercial CTA ── */}
          <div
            className="relative mt-10 overflow-hidden rounded-3xl border border-[#C9A227]/25 p-8 md:p-12"
            style={{
              background: "linear-gradient(135deg,#1f1b0e 0%,#141006 40%,#0c0c0c 100%)",
              boxShadow: "0 0 0 1px rgba(201, 162, 39,0.12), 0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#C9A227]/12 blur-[80px]" />

            <div className="relative max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/10 px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C9A227]" />
                <span className="text-[0.8125rem] font-bold uppercase tracking-[0.18em] text-[#C9A227]">Get Duuka ProMax for Your Business</span>
              </div>

              <h3 className="text-2xl font-extrabold leading-snug text-white md:text-3xl">
                Want this system for<br />your business?
              </h3>
              <p className="mt-3 text-base leading-relaxed text-white/60">
                Hosted for your business — setup, data migration, staff training, and ongoing support included.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="https://wa.me/256772006344?text=Hi%2C%20I%27m%20interested%20in%20Duuka%20ProMax%20for%20my%20business.%20Please%20send%20me%20pricing%20and%20setup%20details."
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-black shadow-[0_4px_20px_rgba(201, 162, 39,0.3)] transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(180deg,#DEBD54 0%,#C9A020 100%)" }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden><path d={WA_PATH}/></svg>
                  WhatsApp us now
                </a>
                <a
                  href="https://app.eagleinfosolutions.com"
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 transition active:scale-[0.98] hover:border-[#C9A227]/30 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                    <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  app.eagleinfosolutions.com
                </a>
                <a
                  href="tel:+256772006344"
                  className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 transition active:scale-[0.98] hover:border-white/25 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.07 9.8 19.79 19.79 0 0 1 2 1.18 2 2 0 0 1 4 .03h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 14.92z"/>
                  </svg>
                  +256 772 006 344
                </a>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ── Footer ── */}
      <footer className="mt-8 border-t border-white/6 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image src="/eagle-info-logo.png" alt="Eagle Info Solutions" width={28} height={28} className="h-7 w-7 object-contain" />
              <div>
                <p className="text-xs font-bold text-white">Eagle Info Solutions</p>
                <p className="text-[0.75rem] text-white/55">Powered by Duuka ProMax · © {new Date().getFullYear()}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { href: "https://www.facebook.com/EagleInfoSolutions", label: "Facebook", icon: <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" fill="currentColor"/> },
                { href: "https://www.instagram.com/EagleInfo_UG", label: "Instagram", icon: <><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></> },
                { href: "https://www.tiktok.com/@EagleInfo_UG", label: "TikTok", icon: <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.78a4.85 4.85 0 01-1.01-.09z" fill="currentColor"/> },
                { href: "https://www.linkedin.com/company/104326797/", label: "LinkedIn", icon: <><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" fill="currentColor"/><circle cx="4" cy="4" r="2" fill="currentColor"/></> },
              ].map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 text-white/55 transition hover:border-[#C9A227]/30 hover:text-[#C9A227]">
                  <svg width="12" height="12" viewBox="0 0 24 24">{s.icon}</svg>
                </a>
              ))}
              <Link href="/feedback" className="text-xs font-semibold text-red-400/60 transition hover:text-red-400">Complaint</Link>
              <Link href="/login" className="text-xs font-semibold text-white/55 transition hover:text-[#C9A227]">Staff Login</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
