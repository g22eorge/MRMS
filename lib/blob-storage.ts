import "server-only";

import { randomUUID } from "crypto";
import { put, del } from "@vercel/blob";

/**
 * Repair-photo storage on Vercel Blob. Local disk is ephemeral on Vercel, so
 * photos that must survive (and be shown in the client portal) live in Blob and
 * are referenced by their public CDN URL. Guarded so the app degrades cleanly
 * when BLOB_READ_WRITE_TOKEN is not configured.
 */

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
  if (!blobConfigured()) return { ok: false, error: "Photo storage is not configured yet (BLOB_READ_WRITE_TOKEN)." };
  if (!file || !file.size) return { ok: false, error: "Empty file." };
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Only JPG, PNG or WebP images are allowed." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Each image must be 5 MB or smaller." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidImageSignature(file.type, bytes)) return { ok: false, error: "That file is not a valid image." };

  const ext = file.type.split("/")[1] || "jpg";
  const key = `jobs/${jobId}/${Date.now()}-${randomUUID()}.${ext}`;
  try {
    const res = await put(key, Buffer.from(bytes), {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { ok: true, image: { url: res.url, key, mimeType: file.type, sizeBytes: file.size } };
  } catch (e) {
    return { ok: false, error: `Upload failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 140)}` };
  }
}

/** Best-effort blob deletion (by URL or key); never throws. */
export async function deleteBlobObject(urlOrKey: string | null | undefined): Promise<void> {
  if (!urlOrKey || !blobConfigured()) return;
  await del(urlOrKey, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});
}
