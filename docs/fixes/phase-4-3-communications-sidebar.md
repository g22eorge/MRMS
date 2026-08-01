# Fix 4.3 — Communications top-level sidebar and `/outbox` redirect

**Phase:** 4 (workflow)  
**Source:** [`system-analysis.md`](../system-analysis.md) FLOW-3 / Phase 4 item 3  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Operational messaging (outbox, templates, WhatsApp config, policies) lived under **Settings → Notifications**, while the dashboard promoted the outbox as a first-class operational queue. The shortcut `/outbox` 404'd. Staff had to drill through settings to reach delivery tooling that the dashboard already surfaced.

---

## Change

### Canonical routes (`/communications/*`)

- **`/communications/outbox`** — delivery queue (re-exports existing outbox page)
- **`/communications/templates`** — templates + nudge sequencing
- **`/communications/policies`** — redirects to `templates#policies`
- **`/communications/whatsapp`** — Meta WhatsApp config (ADMIN only)

Page implementations remain at `app/(app)/settings/notifications/{outbox,templates,whatsapp}/page.tsx`; canonical routes re-export them and wrap with `CommunicationsShell`.

Personal notification **preferences** stay at `/settings/notifications`.

### Redirects

- `next.config.ts`: `/outbox`, legacy `/settings/notifications/{outbox,templates,whatsapp}`, and `/communications/policies` → canonical targets
- `app/(app)/outbox/page.tsx`: server redirect to `/communications/outbox`

### Navigation

- New **Communications** sidebar group (Outbox, Templates, Policies, WhatsApp) for ADMIN/OPS
- Dashboard Communications card links updated to canonical routes
- Settings hub shortcuts and Messages group retitled **Communications** with canonical links

### Shared helpers

- `lib/communications/routes.ts` — `COMMUNICATIONS_ROUTES`, nav config, role gates
- `lib/communications/revalidate.ts` — revalidate canonical + legacy paths after mutations
- `components/communications/CommunicationsShell.tsx` — tab nav shell (Policies highlights on `templates#policies`)

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/communications-routes.test.ts
```

Manual:

1. Sidebar shows **Communications** section for ADMIN/OPS.
2. `/outbox` and legacy settings notification URLs redirect to `/communications/*`.
3. Dashboard **Fix** / Outbox links land on `/communications/outbox`.
4. `/settings/notifications` still shows personal preferences only.

---

## Files

| File | Role |
|------|------|
| `lib/communications/routes.ts` | Canonical paths + nav + access gates |
| `lib/communications/revalidate.ts` | Path revalidation after comms mutations |
| `components/communications/CommunicationsShell.tsx` | Communications tab shell |
| `app/(app)/communications/**` | Layout + canonical route re-exports |
| `app/(app)/outbox/page.tsx` | `/outbox` redirect stub |
| `next.config.ts` | Legacy path redirects |
| `components/layout/AppSidebar.tsx` | Top-level Communications nav group |
| `app/(app)/dashboard/page.tsx` | Dashboard comms card links |
| `app/(app)/settings/layout.tsx` | Settings hub Communications shortcuts |
| `tests/unit/communications-routes.test.ts` | Route + role nav tests |
