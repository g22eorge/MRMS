/**
 * Which Payment rows count as money coming in.
 *
 * Payment.kind is free text with a "PAYMENT" default, and a deposit, a partial
 * or a closing balance is recorded under its own kind — DEPOSIT, PARTIAL,
 * BALANCE, ADJUSTMENT — while a refund is stored as REFUND with a positive
 * amount and negated at read time.
 *
 * Cash reports filtered on kind = "PAYMENT" exactly, which quietly excluded
 * every one of the others. An invoice's paidAmount counted a deposit and the
 * job showed as paid, while Reports, the revenue sparkline, the dashboard tile
 * and the customer's own portal all counted it as nothing. care is carrying two
 * BALANCE payments worth 440,000 that no report has ever shown.
 *
 * The rule is not "kind is PAYMENT", it is "kind is not REFUND", and writing it
 * that way means a kind invented later is counted rather than silently dropped.
 */
export const INCOMING_PAYMENT: { kind: { not: string } } = { kind: { not: "REFUND" } };

/** The mirror of the above: money paid back out. */
export const OUTGOING_PAYMENT: { kind: string } = { kind: "REFUND" };
