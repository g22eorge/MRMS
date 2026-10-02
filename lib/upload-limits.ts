/**
 * Upload limits — dependency-free source of truth.
 *
 * Split out of lib/blob-storage.ts (which is `server-only` + Vercel/UploadThing
 * SDKs) so unit tests can import the real limits without pulling server
 * dependencies into the bun test runner. blob-storage re-exports these.
 */

// HEIC/HEIF is what an iPhone produces by default; accepted and converted to
// JPEG on the way in (see uploadJobImage in lib/blob-storage.ts).
export const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// Phone photos routinely exceed 5 MB; this is the pre-conversion input limit.
export const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
export const isHeicType = (mimeType: string): boolean => HEIC_TYPES.has(mimeType);

/** HEIF-family ftyp brands an iPhone (or a converter) can emit. */
const HEIF_BRANDS = new Set([
  "heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1",
]);

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
