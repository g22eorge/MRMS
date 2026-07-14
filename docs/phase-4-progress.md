# Phase 4 — Workflow & UX: progress log

**Branch:** `phase-0-bug-triage` (continued)  
**Source plan:** [`system-analysis.md`](./system-analysis.md) → Consolidation roadmap → Phase 4  
**Method:** one fix at a time; document in `docs/fixes/`; one commit per fix.

| # | Task | Status | Commit | Tested |
|---|------|--------|--------|--------|
| 4.1 | Job-completion → invoice → payment guided sequence (FLOW-1) | ✅ Done | 08df1f7 | ✅ tsc + unit |
| 4.2 | One-click overdue reminders + bulk bucket reminders | ✅ Done | d59e795 | ✅ unit |
| 4.3 | Communications top-level sidebar; `/outbox` redirect | ✅ Done | 509c05a | ✅ unit |
| 4.4 | Documents hub with tabs + per-job document timeline | ✅ Done | a868b45 | ✅ unit |
| 4.5 | Global ⌘K command palette | ⬜ Pending | — | — |
| 4.6 | Standard loading/empty/not-found/error contract | ⬜ Pending | — | — |
| 4.7 | Quote follow-up nudges + draft expiry policy | ⬜ Pending | — | — |

---

## Log

### 4.1 — Job completion billing flow

**Change:** Guided modal after `COMPLETED` status; `issueJobInvoiceAction`; `statusChangedTo` on `updateJobAction`; mobile `nextStatus` fix.

**Doc:** [`fixes/phase-4-1-job-completion-flow.md`](./fixes/phase-4-1-job-completion-flow.md)

### 4.2 — Overdue invoice reminders

**Change:** Outbox-backed overdue reminder messages; per-row **Send reminder** and **Remind all in bucket** on invoices aging views.

**Doc:** [`fixes/phase-4-2-invoice-overdue-reminders.md`](./fixes/phase-4-2-invoice-overdue-reminders.md)

### 4.3 — Communications sidebar + `/outbox` redirect

**Change:** Top-level **Communications** sidebar section; canonical `/communications/*` routes; `/outbox` and legacy settings notification paths redirect; dashboard and settings links updated.

**Doc:** [`fixes/phase-4-3-communications-sidebar.md`](./fixes/phase-4-3-communications-sidebar.md)

### 4.4 — Documents hub + job document timeline

**Change:** Tabbed **Documents** hub shell for all document list pages; `/documents` redirects to role-default tab; job detail **Documents** tab shows chronological paperwork lifecycle.

**Doc:** [`fixes/phase-4-4-documents-hub-timeline.md`](./fixes/phase-4-4-documents-hub-timeline.md)
