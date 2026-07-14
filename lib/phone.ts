export type UgPhoneFormat = "e164" | "whatsapp" | "digits";

export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Normalize Uganda mobile numbers for SMS (E.164), WhatsApp API (256… digits), or generic digits.
 * Falls back to digit-only input when the number is not a recognizable UG mobile shape.
 */
export function normalizeUgPhone(
  input: string | null | undefined,
  options?: { format?: UgPhoneFormat },
): string | null {
  const format = options?.format ?? "e164";
  if (input == null) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const digits = digitsOnly(trimmed);
  if (!digits) return null;

  let normalizedDigits = digits;

  if (digits.startsWith("256")) {
    normalizedDigits = digits;
  } else if (digits.length === 10 && digits.startsWith("0")) {
    normalizedDigits = `256${digits.slice(1)}`;
  } else if (digits.length === 9 && digits.startsWith("7")) {
    normalizedDigits = `256${digits}`;
  }

  if (format === "e164") {
    return normalizedDigits.startsWith("+") ? normalizedDigits : `+${normalizedDigits}`;
  }

  return normalizedDigits.replace(/^\+/, "");
}

/** Canonical storage/display baseline — E.164 when parseable, otherwise trimmed input. */
export function normalizePhoneForStorage(input: string): string {
  return normalizeUgPhone(input, { format: "e164" }) ?? input.trim();
}

/** Human-readable display: +256 7XX XXX XXX for standard UG mobiles. */
export function formatPhoneDisplay(input: string | null | undefined): string {
  if (!input?.trim()) return "—";

  const e164 = normalizeUgPhone(input, { format: "e164" });
  if (!e164) return input.trim();

  const digits = digitsOnly(e164);
  if (digits.startsWith("256") && digits.length === 12) {
    const local = digits.slice(3);
    return `+256 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }

  return e164;
}

export function phoneTelHref(input: string | null | undefined): string | null {
  const e164 = normalizeUgPhone(input, { format: "e164" });
  return e164 ? `tel:${e164}` : null;
}

export function phoneWhatsAppHref(input: string | null | undefined): string | null {
  const wa = normalizeUgPhone(input, { format: "whatsapp" });
  return wa ? `https://wa.me/${wa}` : null;
}

/** Alternate stored shapes for duplicate detection (077… vs +256…). */
export function phoneLookupVariants(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);
  const e164 = normalizeUgPhone(trimmed, { format: "e164" });
  const whatsapp = normalizeUgPhone(trimmed, { format: "whatsapp" });

  if (e164) variants.add(e164);
  if (whatsapp) variants.add(whatsapp);
  if (whatsapp?.startsWith("256") && whatsapp.length === 12) {
    variants.add(`0${whatsapp.slice(3)}`);
  }

  return [...variants];
}
