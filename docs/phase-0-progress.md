# Phase 0 — Visible-bug triage: progress log

**Branch:** `phase-0-bug-triage` (from `main` @ 74a8271)
**Source plan:** [`system-analysis.md`](./system-analysis.md) → Consolidation roadmap → Phase 0
**Method:** one small task at a time; each fix is tested in the running app (localhost:3001) before the next starts; one commit per fix.

| # | Task | Status | Commit | Tested |
|---|------|--------|--------|--------|
| — | Branch + docs baseline | ✅ Done | 5853f7c | n/a |
| 0.1 | Fix `/platform-admin` crash (`undefined 'users'`) | ⬜ Pending | — | — |
| 0.2 | Real page titles: credit notes, delivery notes, POS | ⬜ Pending | — | — |
| 0.3 | `notFound()` guard on `/jobs/[id]` (fixes `/jobs/board` skeleton) | ⬜ Pending | — | — |
| 0.4 | Dashboard outbox label: "5 failed · 38 dead" not "43 failed" | ⬜ Pending | — | — |
| 0.5 | Clients "new this month" KPI (77/77 import artifact) | ⬜ Pending | — | — |

---

## Log

### Setup — 2026-07-14

- Created branch `phase-0-bug-triage` from `main` (74a8271).
- Committed `docs/system-analysis.md` (new) and `docs/duplication-review.md` (now a pointer) as the baseline: 5853f7c.

<!-- Entries below are appended as each task completes: what changed, files touched, how it was tested, result. -->
