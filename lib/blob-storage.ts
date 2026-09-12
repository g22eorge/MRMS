import "server-only";

import { randomUUID } from "crypto";
import { put, del, get } from "@vercel/blob";
import { UTApi } from "uploadthing/server";

/**
 * Repair-photo storage. New uploads go to UploadThing when UPLOADTHING_TOKEN is
 * set, otherwise to Vercel Blob. Blob objects are private; UploadThing objects
 * are public-read (its free tier refuses private files), so their URL is a
 * bearer capability the app never hands to a browser. Every read is streamed
 * through /api/photos/[id], which enforces authorisation either way.
 *
 * Both backends stay readable at once so photos uploaded before the switch keep
 * working without a migration; reads are routed per photo by its stored key.
 * Guarded so the app degrades cleanly when neither backend is configured.
 */

// HEIC/HEIF is what an iPhone produces by default, so it is accepted and
// converted to JPEG on the way in (see uploadJobImage) — browsers cannot decode
// HEIC, so storing it as-is would mean photos that upload but never display.
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
// Phone photos routinely exceed 5 MB; this is the pre-conversion input limit.
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function uploadthingConfigured(): boolean {
  return Boolean(process.env.UPLOADTHING_TOKEN);
}

/** True when photos can be stored at all (either backend). */
export function photoStorageConfigured(): boolean {
  return uploadthingConfigured() || blobConfigured();
}

let utapi: UTApi | null = null;
function ut(): UTApi {
  // Reads UPLOADTHING_TOKEN from the environment by default.
  utapi ??= new UTApi();
  return utapi;
}

/**
 * Public object URL for an UploadThing file key. The app id is read out of the
 * token (base64 JSON: { apiKey, appId, regions }) so serving a photo costs no
 * API round-trip. Returns null if the token is missing or malformed.
 */
function publicUploadThingUrl(key: string): string | null {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) return null;
  try {
    const { appId } = JSON.parse(Buffer.from(token, "base64").toString("utf8")) as { appId?: string };
    return appId ? `https://${appId}.ufs.sh/f/${key}` : null;
  } catch {
    return null;
  }
}

/**
 * Which backend a stored photo belongs to. UploadThing file keys are opaque and
 * contain no "/", while Vercel Blob keys are paths ("jobs/<id>/<file>") and blob
 * URLs are absolute — so the presence of a slash separates them. Hosted
 * UploadThing URLs are matched explicitly for rows that only kept a url.
 */
export function isUploadThingRef(urlOrKey: string): boolean {
  if (/(^|\/\/)[^/]*\b(ufs\.sh|utfs\.io)/.test(urlOrKey)) return true;
  return !urlOrKey.includes("/");
}

/** Magic-byte check so a renamed non-image can't slip through the type filter. */
export function hasValidImageSignature(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (contentType === "image/webp") {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 // RIFF
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50; // WEBP
  }
  if (HEIC_TYPES.has(contentType)) {
    // ISO-BMFF: "ftyp" at offset 4, then a HEIF-family brand at offset 8.
    const ftyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
    if (!ftyp) return false;
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return HEIF_BRANDS.has(brand);
  }
  return false;
}

/** HEIF-family ftyp brands an iPhone (or a converter) can emit. */
const HEIF_BRANDS = new Set([
  "heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1",
]);

/**
 * Decode HEIC/HEIF to JPEG. The library is pulled in on demand so the decoder is
 * only loaded when someone actually uploads a HEIC. Returns null on failure so
 * the caller can report a clean error instead of throwing.
 */
async function heicToJpeg(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const { default: convert } = await import("heic-convert");
    const out = await convert({ buffer: Buffer.from(bytes), format: "JPEG", quality: 0.85 });
    const copy = new Uint8Array(new ArrayBuffer(out.byteLength));
    copy.set(new Uint8Array(out));
    return copy;
  } catch {
    return null;
  }
}

/**
 * Transport-level failures worth one retry — a dropped socket or HTTP/2 GOAWAY
 * from the ingest endpoint, as opposed to a rejected token or an invalid file.
 */
function isTransientUploadError(err: { message?: string; code?: string } | null | undefined): boolean {
  const text = `${err?.code ?? ""} ${err?.message ?? ""}`.toLowerCase();
  return /transport|socket|goaway|econnreset|etimedout|fetch failed|network/.test(text);
}

export type UploadedImage = { url: string; key: string; mimeType: string; sizeBytes: number };

/**
 * Validate + upload a single image to Blob under a job. Returns a discriminated
 * result; the caller decides how to surface `error` (e.g. skip this file).
 */
export async function uploadJobImage(jobId: string, file: File): Promise<{ ok: true; image: UploadedImage } | { ok: false; error: string }> {
  if (!photoStorageConfigured()) {
    return { ok: false, error: "Photo storage is not configured yet (UPLOADTHING_TOKEN or BLOB_READ_WRITE_TOKEN)." };
  }
  if (!file || !file.size) return { ok: false, error: "Empty file." };
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: `Only JPG, PNG, WebP or HEIC images are allowed${file.type ? ` (got ${file.type})` : ""}.` };
  }
  if (file.size > MAX_BYTES) return { ok: false, error: "Each image must be 15 MB or smaller." };

  let bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidImageSignature(file.type, bytes)) return { ok: false, error: "That file is not a valid image." };

  // iPhone photos arrive as HEIC, which no browser can display — convert to JPEG
  // so the job page and the customer portal can actually render them.
  let mimeType = file.type;
  if (HEIC_TYPES.has(mimeType)) {
    const jpeg = await heicToJpeg(bytes);
    if (!jpeg) return { ok: false, error: "That HEIC image could not be converted. Try exporting it as JPEG." };
    bytes = jpeg;
    mimeType = "image/jpeg";
  }

  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] || "jpg";
  const key = `jobs/${jobId}/${Date.now()}-${randomUUID()}.${ext}`;

  let utError = "";
  if (uploadthingConfigured()) {
    try {
      // public-read, not private: UploadThing rejects private files on free apps
      // ("Private files are not allowed for free apps"). The object URL is
      // therefore a bearer capability — anyone holding it can read the file — so
      // the app never hands it to a browser; /api/photos/[id] proxies every read
      // and keeps enforcing the staff/portal and CLIENT/INTERNAL checks.
      // Switch this back to "private" if the app moves to a paid tier.
      const named = new File([bytes], `${jobId}-${Date.now()}-${randomUUID()}.${ext}`, { type: mimeType });
      // One retry: the ingest endpoint occasionally drops the connection
      // mid-upload (HTTP/2 GOAWAY / UND_ERR_SOCKET), which otherwise loses the
      // photo for a transient network hiccup. Config and validation errors are
      // not retried — they would just fail identically.
      let res = await ut().uploadFiles(named, { acl: "public-read" });
      if (res.error && isTransientUploadError(res.error)) {
        res = await ut().uploadFiles(named, { acl: "public-read" });
      }
      if (res.error || !res.data) {
        utError = String(res.error?.message ?? "unknown UploadThing error");
      } else {
        return { ok: true, image: { url: res.data.ufsUrl, key: res.data.key, mimeType, sizeBytes: bytes.length } };
      }
    } catch (e) {
      utError = e instanceof Error ? e.message : String(e);
    }

    // UploadThing is configured but did not accept the file — a bad token, a
    // rejected ACL, an outage. If Blob is also configured, store there rather
    // than losing the photo; a misconfigured new backend should not take down
    // photo upload on a shop that already had a working one.
    if (!blobConfigured()) {
      return { ok: false, error: `Upload failed: ${utError.slice(0, 140)}` };
    }
    console.error("[storage] UploadThing rejected the upload, falling back to Vercel Blob:", utError);
  }

  try {
    const res = await put(key, Buffer.from(bytes), {
      access: "private",
      contentType: mimeType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { ok: true, image: { url: res.url, key, mimeType, sizeBytes: bytes.length } };
  } catch (e) {
    return { ok: false, error: `Upload failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 140)}` };
  }
}

/**
 * Upload an organisation's document logo.
 *
 * Separate from uploadJobImage because the constraints differ and because the
 * thing it replaces was dangerous: logo upload used to write every file to
 * public/eagle-info-logo.png — one shared path, hardcoded to one tenant's name.
 * On the multi-tenant deployment a tenant uploading their logo replaced it for
 * every other tenant, and on a read-only serverless filesystem the write failed
 * outright, so the feature was both broken and cross-tenant.
 *
 * Stored public-read on purpose: a logo is printed on documents the business
 * hands to its own customers, so it is not a secret, and the PDF renderer needs
 * to fetch it without carrying a credential. No HEIC — a logo comes from a
 * design tool, not a phone camera, and skipping the decoder keeps this path
 * small. No SVG either: it is a script-bearing format and this is rendered into
 * documents and served to browsers.
 */
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export async function uploadOrgLogo(
  orgId: string,
  file: File,
): Promise<{ ok: true; image: UploadedImage } | { ok: false; error: string }> {
  if (!photoStorageConfigured()) {
    return { ok: false, error: "File storage is not configured yet (UPLOADTHING_TOKEN or BLOB_READ_WRITE_TOKEN)." };
  }
  if (!file || !file.size) return { ok: false, error: "Select a logo file." };
  if (!LOGO_TYPES.has(file.type)) {
    return { ok: false, error: `Use a PNG, JPEG or WebP image${file.type ? ` (got ${file.type})` : ""}.` };
  }
  if (file.size > LOGO_MAX_BYTES) return { ok: false, error: "The logo must be 2 MB or smaller." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Magic bytes, not the declared type: a renamed file would otherwise pass.
  if (!hasValidImageSignature(file.type, bytes)) return { ok: false, error: "That file is not a valid image." };

  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1] || "png";
  const key = `org-logos/${orgId}/${Date.now()}-${randomUUID()}.${ext}`;

  if (uploadthingConfigured()) {
    try {
      const named = new File([bytes], `${orgId}-${Date.now()}.${ext}`, { type: file.type });
      let res = await ut().uploadFiles(named, { acl: "public-read" });
      if (res.error && isTransientUploadError(res.error)) {
        res = await ut().uploadFiles(named, { acl: "public-read" });
      }
      if (!res.error && res.data) {
        return { ok: true, image: { url: res.data.ufsUrl, key: res.data.key, mimeType: file.type, sizeBytes: bytes.length } };
      }
      if (!blobConfigured()) {
        return { ok: false, error: `Upload failed: ${String(res.error?.message ?? "unknown error").slice(0, 140)}` };
      }
    } catch (e) {
      if (!blobConfigured()) {
        return { ok: false, error: `Upload failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 140)}` };
      }
    }
  }

  try {
    // Public here too, unlike job photos: the renderer fetches this by URL.
    const res = await put(key, Buffer.from(bytes), {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { ok: true, image: { url: res.url, key, mimeType: file.type, sizeBytes: bytes.length } };
  } catch (e) {
    return { ok: false, error: `Upload failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 140)}` };
  }
}

/** Best-effort deletion (by URL or key) from whichever backend holds it; never throws. */
export async function deleteBlobObject(urlOrKey: string | null | undefined): Promise<void> {
  if (!urlOrKey) return;
  if (isUploadThingRef(urlOrKey)) {
    if (!uploadthingConfigured()) return;
    await ut().deleteFiles(urlOrKey).catch(() => {});
    return;
  }
  if (!blobConfigured()) return;
  await del(urlOrKey, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});
}

/**
 * Read a private blob server-side (authenticated with the RW token). Returns a
 * stream + content type for the caller's own authorised route to relay, or null
 * if unavailable. The blob is never exposed to the browser directly.
 */
export async function streamPrivateBlob(
  urlOrKey: string,
): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string } | null> {
  if (isUploadThingRef(urlOrKey)) {
    if (!uploadthingConfigured()) return null;
    // Files are public-read (see uploadJobImage), so the object is fetched
    // directly by URL — no API round-trip. If the app is later moved to a paid
    // tier and uploads switch to private, that direct read 403s and the signed
    // URL below takes over, so both tiers keep working.
    const direct = urlOrKey.startsWith("http") ? urlOrKey : publicUploadThingUrl(urlOrKey);
    if (direct) {
      const res = await fetch(direct).catch(() => null);
      if (res?.ok && res.body) {
        return { stream: res.body, contentType: res.headers.get("content-type") || "application/octet-stream" };
      }
    }
    try {
      // No expiresIn: that option requires an override enabled on the
      // UploadThing dashboard, so the app default is used instead. The signed
      // URL is fetched server-side and relayed; the browser never receives it.
      const { ufsUrl } = await ut().generateSignedURL(urlOrKey);
      const res = await fetch(ufsUrl);
      if (!res.ok || !res.body) return null;
      return { stream: res.body, contentType: res.headers.get("content-type") || "application/octet-stream" };
    } catch {
      return null;
    }
  }
  if (!blobConfigured()) return null;
  try {
    const res = await get(urlOrKey, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return { stream: res.stream, contentType: res.blob.contentType || "application/octet-stream" };
  } catch {
    return null;
  }
}
