import { access, readFile } from "node:fs/promises";
import path from "node:path";

export function prettyEnum(value: string | null | undefined): string {
  if (!value) return "N/A";
  return value.replaceAll("_", " ");
}

export function compactText(value: string | null | undefined, max = 90): string {
  if (!value) return "N/A";
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}...`;
}

/**
 * True when a value carries information a reader would want printed.
 *
 * compactText/compactListText return the literal string "N/A" for an empty
 * field, which is truthy — so the usual `{props.x ? <Text/> : null}` guard
 * renders "Accessories: N/A" instead of omitting the line. Templates that care
 * about a clean page should test with this rather than truthiness.
 */
export function hasValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const flat = value.trim().toLowerCase();
  return flat !== "" && flat !== "n/a" && flat !== "-" && flat !== "none";
}

export function compactListText(value: string | null | undefined, max = 220): string {
  if (!value) return "N/A";
  const normalized = value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
}

export async function toDataUriFromRemote(url: string): Promise<string | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "image/png";
  const bytes = new Uint8Array(await res.arrayBuffer());
  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function toDataUriFromLocal(filePath: string, contentType: string): Promise<string> {
  const bytes = await readFile(filePath);
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

type LogoCandidate = { file: string; type: string };

/**
 * First candidate that exists, in list order.
 *
 * This used to be Promise.any over access(), which resolves with whichever
 * check happens to settle first. The list read like a priority order but was
 * not one, so which logo a document got came down to disk timing.
 */
async function firstExistingLogo(candidates: LogoCandidate[]): Promise<string | undefined> {
  for (const c of candidates) {
    try {
      await access(c.file);
      return await toDataUriFromLocal(c.file, c.type);
    } catch {
      // next candidate
    }
  }
  return undefined;
}

/**
 * Documents print on white. The brand asset is white artwork on a solid black
 * field, which lands as a black slab on paper, so a dark-on-transparent variant
 * wins wherever one exists. The app UI keeps using the original.
 */
const DOC_LOGO_FIRST: LogoCandidate[] = [
  { file: path.join(process.cwd(), "public", "eagle-info-logo-doc.png"), type: "image/png" },
];

/** Resolve logo for job-card and quotation PDFs (eagle-info-logo variants only). */
export async function resolvePdfLogo(): Promise<string | undefined> {
  const local = await firstExistingLogo([
    ...DOC_LOGO_FIRST,
    { file: path.join(process.cwd(), "public", "eagle-info-logo.png"), type: "image/png" },
    { file: path.join(process.cwd(), "public", "eagle-info-logo.jpg"), type: "image/jpeg" },
    { file: path.join(process.cwd(), "public", "eagle-info-logo.jpeg"), type: "image/jpeg" },
    { file: path.join(process.cwd(), "public", "eagle-info-logo.webp"), type: "image/webp" },
  ]);
  if (local) return local;

  const baseUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (baseUrl) {
    for (const url of [`${baseUrl}/eagle-info-logo.png`, `${baseUrl}/eagle-info-logo.jpg`]) {
      const remote = await toDataUriFromRemote(url);
      if (remote) return remote;
    }
  }
  return undefined;
}

/**
 * Resolve the logo for a document PDF.
 *
 * The bundled files here are Eagle Info's, shipped in public/. This function
 * takes no organisation and never did, so on the commercial deployment every
 * tenant's quotations, invoices and receipts carried Eagle Info's logo — a new
 * repair shop's first quotation went to their client under another business's
 * mark. The company name, address and telephone numbers had the same fault
 * through the branding defaults, so the document was another business's
 * letterhead entirely.
 *
 * A bundled fallback is correct on care, which IS Eagle Info and has exactly
 * one tenant. It is never correct on the commercial deployment: there, a
 * document with no logo is right and a document with somebody else's is not.
 * Until per-organisation logo storage exists, commercial documents print none.
 */
export async function resolveInvoiceLogo(): Promise<string | undefined> {
  const { getDeploymentContext } = await import("@/lib/deployment-context");
  const deployment = await getDeploymentContext().catch(() => null);
  // Fail closed: if the deployment cannot be identified, do not brand the
  // document with a logo that may belong to someone else.
  if (!deployment || deployment.mode !== "CARE_SINGLE_TENANT") return undefined;

  const local = await firstExistingLogo([
    ...DOC_LOGO_FIRST,
    { file: path.join(process.cwd(), "public", "eagle-info-logo.png"), type: "image/png" },
    { file: path.join(process.cwd(), "public", "eagle-info-logo.jpg"), type: "image/jpeg" },
    { file: path.join(process.cwd(), "public", "eagle-info-logo.jpeg"), type: "image/jpeg" },
    { file: path.join(process.cwd(), "public", "eagle-info-logo.webp"), type: "image/webp" },
    { file: path.join(process.cwd(), "public", "invoice-logo.png"), type: "image/png" },
    { file: path.join(process.cwd(), "public", "invoice-logo.jpg"), type: "image/jpeg" },
    { file: path.join(process.cwd(), "public", "invoice-logo.jpeg"), type: "image/jpeg" },
    { file: path.join(process.cwd(), "public", "invoice-logo.webp"), type: "image/webp" },
  ]);
  if (local) return local;

  const explicit = process.env.INVOICE_LOGO_URL;
  if (explicit) {
    if (explicit.startsWith("data:")) return explicit;
    if (explicit.startsWith("http://") || explicit.startsWith("https://")) {
      const remote = await toDataUriFromRemote(explicit);
      if (remote) return remote;
    }
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (baseUrl) {
    for (const url of [
      `${baseUrl}/eagle-info-logo.png`,
      `${baseUrl}/eagle-info-logo.jpg`,
      `${baseUrl}/invoice-logo.png`,
    ]) {
      const remote = await toDataUriFromRemote(url);
      if (remote) return remote;
    }
  }
  return undefined;
}
