# Phase 4 — Workflow & UX: progress log

**Branch:** `phase-0-bug-triage` (continued)  
**Source plan:** [`system-analysis.md`](./system-analysis.md) → Consolidation roadmap → Phase 4  
**Method:** one fix at a time; document in `docs/fixes/`; one commit per fix.

| # | Task | Status | Commit | Tested |
|---|------|--------|--------|--------|
| 4.1 | Job-completion → invoice → payment guided sequence (FLOW-1) | ✅ Done | 08df1f7 | ✅ tsc + unit |
| 4.2 | One-click overdue reminders + bulk bucket reminders | ⬜ Pending | — | — |
| 4.3 | Communications top-level sidebar; `/outbox` redirect | ⬜ Pending | — | — |
| 4.4 | Documents hub with tabs + per-job document timeline | ⬜ Pending | — | — |
| 4.5 | Global ⌘K command palette | ⬜ Pending | — | — |
| 4.6 | Standard loading/empty/not-found/error contract | ⬜ Pending | — | — |
| 4.7 | Quote follow-up nudges + draft expiry policy | ⬜ Pending | — | — |

---

## Log

### 4.1 — Job completion billing flow

**Change:** Guided modal after `COMPLETED` status; `issueJobInvoiceAction`; `statusChangedTo` on `updateJobAction`; mobile `nextStatus` fix.

**Doc:** [`fixes/phase-4-1-job-completion-flow.md`](./fixes/phase-4-1-job-completion-flow.md)
