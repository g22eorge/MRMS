# Fix 3.5 — Platform route consolidation

**Phase:** 3 (structural)  
**Source:** [`system-analysis.md`](../system-analysis.md) finding 16 / Phase 3 item 5  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

`/platform` and `/platform-admin` were parallel trees that drifted (the admin copy crashed on `OrgTable` `_count`). Platform-admin gates were duplicated across `lib/session.ts`, login routes, and env reads. Platform pages hard-coded paths and repeated plan/status chip classes. Login always sent users to `/dashboard` even for platform admins.

---

## Change

### Canonical platform console: `/platform`

- `platform-admin/*` remains as **redirect stubs only** → `/platform` (via `PLATFORM_ROUTES`)
- Shared route constants + chip styles in `lib/platform/routes.ts`
- Shared cache revalidation in `lib/platform/revalidate.ts`
- Login redirect helper in `lib/platform/login-redirect.ts` (`platform_admin` permission or configured email → `/platform`)

### Unified platform-admin gates

- `lib/platform-admin.ts` exports `isPlatformAdminEmail()` alias; `lib/session.ts` uses it
- `/api/login` and `/api/auth/[...all]` use `checkIsPlatformAdmin()` instead of direct env reads
- Login sets `x-login-redirect`; login form follows it

### Platform pages updated

- Nav, org list, org detail, payments, audit use `PLATFORM_ROUTES`
- `OrgTable` and org pages share `PLATFORM_PLAN_CHIP` / `PLATFORM_STATUS_CHIP`
- Platform actions/settings actions use shared revalidate helpers (removed legacy `/platform-admin` revalidate)

### Extracted inline server action

- `app/(app)/admin/orgs/actions.ts` — `setOrgModulesAction` moved out of page file

### Tests

- `tests/unit/platform-routes.test.ts`
- `tests/unit/platform-login-redirect.test.ts`
- `tests/unit/api/login.test.ts` updated for `/platform` redirect + `auth.handler` mock

---

## Verification

```bash
pnpm exec tsc --noEmit
npx bun test tests/unit/platform-routes.test.ts tests/unit/platform-login-redirect.test.ts tests/unit/api/login.test.ts
```

Manual: `/platform-admin` and `/platform-admin/orgs/:id` redirect to `/platform`; platform admin login lands on `/platform`.

---

## Phase 3 complete

All five structural items (3.1–3.5) are done on branch `phase-0-bug-triage`.
