# Phase 1 — Safe refactors: progress log

**Branch:** `phase-0-bug-triage` (continued from Phase 0)  
**Source plan:** [`system-analysis.md`](./system-analysis.md) → Consolidation roadmap → Phase 1  
**Method:** one fix at a time; document in `docs/fixes/`; one commit per fix.

| # | Task | Status | Commit | Tested |
|---|------|--------|--------|--------|
| 1.1 | `lib/constants/payment-methods.ts` | ✅ Done | dc15632 | ✅ tsc |
| 1.2 | Platform pages → `formatMoney` from `lib/currency.ts` | ⬜ Pending | — | — |
| 1.3 | `lib/date-ranges.ts` + date display policy | ⬜ Pending | — | — |
| 1.4 | Job PDF routes → `generate*Buffer` | ⬜ Pending | — | — |
| 1.5 | Remove dead code | ⬜ Pending | — | — |

---

## Log

### 1.1 — Payment method constant

**Change:** Added `lib/constants/payment-methods.ts`; replaced 5 inline arrays with shared `PAYMENT_METHODS`, `parsePaymentMethod`, `formatPaymentMethodLabel`.

**Doc:** [`fixes/phase-1-1-payment-methods-constant.md`](./fixes/phase-1-1-payment-methods-constant.md)
