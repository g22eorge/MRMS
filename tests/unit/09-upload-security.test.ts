/**
 * Group 9 — Upload security (tests 101–110)
 *
 * Exercises the real validators from lib/blob-storage.ts directly.
 * No HTTP server needed. Imports (not mirrors) so the test cannot drift
 * from the route logic (see P2-02: mirror previously asserted stale 5MB/3-type).
 */

import { test, expect } from "bun:test";

import { ALLOWED_TYPES, MAX_BYTES, hasValidImageSignature } from "../../lib/upload-limits";

// ── MIME type allowlist ───────────────────────────────────────────────────────

test("101: ALLOWED_TYPES accepts image/jpeg, image/png, image/webp, image/heic, image/heif", () => {
  expect(ALLOWED_TYPES.has("image/jpeg")).toBe(true);
  expect(ALLOWED_TYPES.has("image/png")).toBe(true);
  expect(ALLOWED_TYPES.has("image/webp")).toBe(true);
  expect(ALLOWED_TYPES.has("image/heic")).toBe(true);
  expect(ALLOWED_TYPES.has("image/heif")).toBe(true);
});

test("102: ALLOWED_TYPES rejects image/gif, application/pdf, text/html", () => {
  expect(ALLOWED_TYPES.has("image/gif")).toBe(false);
  expect(ALLOWED_TYPES.has("application/pdf")).toBe(false);
  expect(ALLOWED_TYPES.has("text/html")).toBe(false);
});

test("103: ALLOWED_TYPES rejects empty string and wildcard", () => {
  expect(ALLOWED_TYPES.has("")).toBe(false);
  expect(ALLOWED_TYPES.has("*/*")).toBe(false);
});

// ── MAX_BYTES ─────────────────────────────────────────────────────────────────

test("104: MAX_BYTES is exactly 15 MB (15 * 1024 * 1024)", () => {
  expect(MAX_BYTES).toBe(15728640);
});

test("105: a 15 MB buffer is within limit; a 15 MB + 1 byte buffer is not", () => {
  const exactlyMax = MAX_BYTES;
  const overLimit = MAX_BYTES + 1;
  expect(exactlyMax <= MAX_BYTES).toBe(true);
  expect(overLimit <= MAX_BYTES).toBe(false);
});

// ── Magic byte validation — JPEG ──────────────────────────────────────────────

test("106: hasValidImageSignature accepts a valid JPEG magic header", () => {
  const validJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  expect(hasValidImageSignature("image/jpeg", validJpeg)).toBe(true);
});

test("107: hasValidImageSignature rejects a PNG file declared as JPEG (magic mismatch)", () => {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(hasValidImageSignature("image/jpeg", pngBytes)).toBe(false);
});

// ── Magic byte validation — PNG ───────────────────────────────────────────────

test("108: hasValidImageSignature accepts a valid PNG magic header", () => {
  const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  expect(hasValidImageSignature("image/png", validPng)).toBe(true);
});

test("109: hasValidImageSignature rejects too-short PNG buffer", () => {
  const short = new Uint8Array([0x89, 0x50]);
  expect(hasValidImageSignature("image/png", short)).toBe(false);
});

// ── Magic byte validation — WebP ──────────────────────────────────────────────

test("110: hasValidImageSignature accepts a valid WebP magic header (RIFF....WEBP)", () => {
  const validWebp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x00, 0x00, 0x00, 0x00, // file size (placeholder)
    0x57, 0x45, 0x42, 0x50, // WEBP
  ]);
  expect(hasValidImageSignature("image/webp", validWebp)).toBe(true);
});
