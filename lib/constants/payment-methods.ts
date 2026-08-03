import type { PaymentMethod } from "@prisma/client";

/** Canonical payment methods shown in finance forms across the app. */
export const PAYMENT_METHODS = [
  "CASH",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
  "CARD",
  "OTHER",
] as const satisfies readonly PaymentMethod[];

export type AppPaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function parsePaymentMethod(
  raw: string,
  fallback: PaymentMethod = "OTHER",
): PaymentMethod {
  const trimmed = raw.trim();
  return isPaymentMethod(trimmed) ? trimmed : fallback;
}

export function formatPaymentMethodLabel(method: PaymentMethod | string): string {
  return method.replaceAll("_", " ");
}
