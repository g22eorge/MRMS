# Phase 1 — Safe refactors: progress log

**Branch:** `phase-0-bug-triage` (continued from Phase 0)  
**Source plan:** [`system-analysis.md`](./system-analysis.md) → Consolidation roadmap → Phase 1  
**Method:** one fix at a time; document in `docs/fixes/`; one commit per fix.

| # | Task | Status | Commit | Tested |
|---|------|--------|--------|--------|
| 1.1 | `lib/constants/payment-methods.ts` | ✅ Done | dc15632 | ✅ tsc |
| 1.2 | Platform pages → `formatMoney` from `lib/currency.ts` | ✅ Done | 38722d7 | ✅ tsc |
| 1.3 | `lib/date-ranges.ts` + date display policy | ✅ Done | 58d164f | ✅ tsc |
| 1.4 | Job PDF routes → `generate*Buffer` | ⬜ Pending | — | — |
| 1.5 | Remove dead code | ⬜ Pending | — | — |

---

## Log

### 1.1 — Payment method constant

**Change:** Added `lib/constants/payment-methods.ts`; replaced 5 inline arrays with shared `PAYMENT_METHODS`, `parsePaymentMethod`, `formatPaymentMethodLabel`.

**Doc:** [`fixes/phase-1-1-payment-methods-constant.md`](./fixes/phase-1-1-payment-methods-constant.md)

### 1.2 — Platform `formatMoney` (38722d7)

**Change:** Removed local `fmtMoney` (`Intl en-UG currency → "USh")` from platform dashboard, payments, and org detail pages; use `formatMoney` from `lib/currency.ts`. Fixed double `UGX` prefix on settings pricing card.

**Doc:** [`fixes/phase-1-2-platform-format-money.md`](./fixes/phase-1-2-platform-format-money.md)

### 1.3 — Date ranges + EAT display (58d164f)

**Change:** Added `lib/date-ranges.ts`; extended `date-eat.ts` with list formatters; standardised document page dates to DD/MM/YYYY; deduped `monthRange` in dashboard, reports, AI insights, copilot.

**Doc:** [`fixes/phase-1-3-date-ranges-and-display.md`](./fixes/phase-1-3-date-ranges-and-display.md)
