import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compressImageInBrowser,
  type BrowserImageAdapter,
  type CanvasContext2DLike,
  type ImageBitmapLike,
  type KeystaticImageValue,
} from "./compressImageInBrowser";

/** A real, valid (if minimal) WebP byte sequence — RIFF/WEBP header + a VP8 chunk tag. */
const REAL_WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);
const GARBAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);

function fakeSource(): KeystaticImageValue {
  // Content doesn't matter to these tests (decoding is entirely mocked away
  // behind the adapter) -- only extension/filename flow through untouched.
  return { data: new Uint8Array([1, 2, 3]), extension: "jpg", filename: "walkaround.JPG" };
}

function fakeBitmap(width: number, height: number) {
  let closeCalls = 0;
  const bitmap: ImageBitmapLike = {
    width,
    height,
    close: () => {
      closeCalls++;
    },
  };
  return { bitmap, getCloseCalls: () => closeCalls };
}

const fakeCtx: CanvasContext2DLike = { drawImage: () => {} };

function adapterWith(opts: {
  bitmap?: ImageBitmapLike;
  decodeError?: Error;
  webpBlob?: Blob | null;
  ctx?: CanvasContext2DLike | null;
}): BrowserImageAdapter {
  return {
    async createImageBitmap() {
      if (opts.decodeError) throw opts.decodeError;
      return opts.bitmap!;
    },
    createCanvas() {
      return {
        getContext: () => (opts.ctx === undefined ? fakeCtx : opts.ctx),
        toWebpBlob: async () => (opts.webpBlob === undefined ? null : opts.webpBlob),
      };
    },
  };
}

test("compressImageInBrowser: correct result -- webp bytes, extension, .webp filename, real magic bytes, bitmap closed", async () => {
  const { bitmap, getCloseCalls } = fakeBitmap(4800, 3200);
  const blob = new Blob([REAL_WEBP_BYTES], { type: "image/webp" });
  const adapter = adapterWith({ bitmap, webpBlob: blob });

  const result = await compressImageInBrowser(fakeSource(), adapter);

  assert.equal(result.extension, "webp");
  assert.equal(result.filename, "walkaround.webp");
  assert.deepEqual(Array.from(result.data), Array.from(REAL_WEBP_BYTES));
  assert.equal(getCloseCalls(), 1, "ImageBitmap.close() must be called on success");
});

test("compressImageInBrowser: throws when the encoded blob's MIME type is not image/webp, and still closes the bitmap", async () => {
  const { bitmap, getCloseCalls } = fakeBitmap(1000, 1000);
  const wrongMimeBlob = new Blob([REAL_WEBP_BYTES], { type: "image/png" });
  const adapter = adapterWith({ bitmap, webpBlob: wrongMimeBlob });

  await assert.rejects(() => compressImageInBrowser(fakeSource(), adapter), /image\/webp/);
  assert.equal(getCloseCalls(), 1, "ImageBitmap.close() must be called even when it throws");
});

test("compressImageInBrowser: throws when toBlob()/convertToBlob() returns null, and still closes the bitmap", async () => {
  const { bitmap, getCloseCalls } = fakeBitmap(1000, 1000);
  const adapter = adapterWith({ bitmap, webpBlob: null });

  await assert.rejects(() => compressImageInBrowser(fakeSource(), adapter), /toBlob|convertToBlob/);
  assert.equal(getCloseCalls(), 1, "ImageBitmap.close() must be called even when it throws");
});

test("compressImageInBrowser: throws a descriptive error on a decode failure (createImageBitmap rejects)", async () => {
  const adapter = adapterWith({ decodeError: new Error("corrupt file") });

  await assert.rejects(
    () => compressImageInBrowser(fakeSource(), adapter),
    /не вдалося декодувати/,
  );
});

test("compressImageInBrowser: throws when the encoded bytes don't actually start with WebP magic bytes, even if the MIME claimed image/webp -- never returns the original silently", async () => {
  const { bitmap, getCloseCalls } = fakeBitmap(1000, 1000);
  const lyingBlob = new Blob([GARBAGE_BYTES], { type: "image/webp" });
  const adapter = adapterWith({ bitmap, webpBlob: lyingBlob });

  const before = fakeSource();
  await assert.rejects(() => compressImageInBrowser(before, adapter), /magic bytes/);
  assert.equal(getCloseCalls(), 1);
  // The rejected promise proves no result was returned at all -- there is
  // no code path in compressImageInBrowser that returns `before` unchanged.
});

test("compressImageInBrowser: rejects an unsupported source extension before ever touching the adapter", async () => {
  const adapter = adapterWith({}); // would throw on use -- must never be called
  await assert.rejects(
    () =>
      compressImageInBrowser(
        { data: new Uint8Array([1]), extension: "gif", filename: "a.gif" },
        adapter,
      ),
    /непідтримуваний формат/,
  );
});
