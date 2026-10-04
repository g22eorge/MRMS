# ADR-001: Money representation (Float vs Decimal/cents)

## Context
Dduuka ProMax stores all monetary values as Prisma `Float`. Schema scan 2026-09-23: `grep Decimal` = 0 hits; ~90 `Float` money/rate/qty fields (e.g. `Job.clientBill`, `Invoice.totalAmount/paidAmount`, `Payment.amount`, `Sale.subtotal/discount/vat/total/paid`, `Part.unitCost/sellingPrice`, `JournalLine.debit/credit`). FX snapshots (`exchangeRateToBase Float?`) present on Invoice/Payment/CreditNote/Sale/PurchaseOrder/SupplierBill/SupplierPayment/Expense/Receipt.

## Problem
Float rounding on ledger-grade fields risks incorrect totals, balances, and FX netting. App-level rounding discipline is UNVERIFIED.

## Options Considered
1. Keep `Float` + add deterministic rounding + unit/integration tests for subtotal/discount/tax/total/paid/balance/refund/reversal paths.
2. Migrate money to `Decimal` (SQLite numeric) or integer minor-units. Correct by construction; large migration (schema + 51 migrations + Turso reconciler + all calculations + seeds).

## Decision
PROPOSED: Option 1 short-term (rounding + tests), Option 2 as tracked P1 tech-debt. No migration until rounding tests prove or disprove safety.

## Reasons
- Evidence shows working financial foundation (purchasing 3-way match, payment-sync derivations, receipt dedupe) — no observed miscalculation, only type risk.
- Scope discipline: do not rewrite working architecture without evidence of failure.

## Consequences
- Must add `tests/unit` money-rounding cases and FX netting cases before RELEASE gate.
- Any new money field must follow the rounding helper (to be defined), never raw float arithmetic in UI.

## Alternatives Rejected
- Immediate Decimal migration: rejected as disproportionate without a failing test.

## Date
2026-09-23

## Status
APPROVED by owner 2026-09-23. Implementation: rounding + money tests first; no Decimal migration until tests prove need.
