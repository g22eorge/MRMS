import "server-only";

import { randomUUID } from "crypto";
import { put, del, get } from "@vercel/blob";
import { UTApi } from "uploadthing/server";

/**
 * Repair-photo storage. New uploads go to UploadThing when UPLOADTHING_TOKEN is
 * set, otherwise to Vercel Blob. Either way the file is stored **private** — the
 * storage URL is not directly viewable — and streamed to authorised viewers only
 * through /api/photos/[id].
 *
 * Both backends stay readable at once so photos uploaded before the switch keep
 * working without a migration; reads are routed per photo by its stored key.
 * Guarded so the app degrades cleanly when neither backend is configured.
 */

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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
  return false;
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
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Only JPG, PNG or WebP images are allowed." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Each image must be 5 MB or smaller." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidImageSignature(file.type, bytes)) return { ok: false, error: "That file is not a valid image." };

  const ext = file.type.split("/")[1] || "jpg";
  const key = `jobs/${jobId}/${Date.now()}-${randomUUID()}.${ext}`;

  if (uploadthingConfigured()) {
    try {
      // Private ACL keeps the file unreadable without a signed URL, matching the
      // Blob behaviour — /api/photos/[id] stays the only way a browser sees it.
      const named = new File([bytes], `${jobId}-${Date.now()}-${randomUUID()}.${ext}`, { type: file.type });
      const res = await ut().uploadFiles(named, { acl: "private" });
      if (res.error || !res.data) {
        return { ok: false, error: `Upload failed: ${String(res.error?.message ?? "unknown UploadThing error").slice(0, 140)}` };
      }
      return { ok: true, image: { url: res.data.ufsUrl, key: res.data.key, mimeType: file.type, sizeBytes: file.size } };
    } catch (e) {
      return { ok: false, error: `Upload failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 140)}` };
    }
  }

  try {
    const res = await put(key, Buffer.from(bytes), {
      access: "private",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { ok: true, image: { url: res.url, key, mimeType: file.type, sizeBytes: file.size } };
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
