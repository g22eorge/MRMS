import { describe, it, expect, mock } from "bun:test";

// "server-only" is supplied by the Next build, not resolvable under bun — stub it
// so the storage module can be imported here.
mock.module("server-only", () => ({}));

const { isUploadThingRef } = await import("../../lib/blob-storage");

// Photos uploaded before the UploadThing switch still live on Vercel Blob. Reads
// and deletes are routed per photo by its stored key, so getting this predicate
// wrong silently 404s every pre-existing photo — hence these cases.

describe("isUploadThingRef — existing Vercel Blob photos", () => {
  it("routes a blob storage key to Blob", () => {
    expect(isUploadThingRef("jobs/cmsi8mpso00032lj0qzqplv72/1755424799-3f1c.png")).toBe(false);
  });

  it("routes a blob URL to Blob", () => {
    expect(isUploadThingRef("https://abc123.public.blob.vercel-storage.com/jobs/x/1-2.jpg")).toBe(false);
  });
});

describe("isUploadThingRef — UploadThing files", () => {
  it("routes an opaque UploadThing file key to UploadThing", () => {
    expect(isUploadThingRef("2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg")).toBe(true);
  });

  it("routes a ufs.sh URL to UploadThing", () => {
    expect(isUploadThingRef("https://abc123.ufs.sh/f/2e0fdb64-9957-4262-8e45-f372ba903ac8")).toBe(true);
  });

  it("routes a legacy utfs.io URL to UploadThing", () => {
    expect(isUploadThingRef("https://utfs.io/f/2e0fdb64-9957-4262-8e45-f372ba903ac8")).toBe(true);
  });
});
