import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTargetSize, toWebpFilename, isWebpMagicBytes, MAX_IMAGE_SIDE } from "./imageOptimization";

test("computeTargetSize: landscape over the limit scales down, preserving aspect ratio", () => {
  const r = computeTargetSize(4800, 3200);
  assert.deepEqual(r, { width: 2400, height: 1600 });
});

test("computeTargetSize: portrait over the limit scales down, preserving aspect ratio", () => {
  const r = computeTargetSize(3200, 4800);
  assert.deepEqual(r, { width: 1600, height: 2400 });
});

test("computeTargetSize: square over the limit scales both sides equally", () => {
  const r = computeTargetSize(5000, 5000);
  assert.deepEqual(r, { width: 2400, height: 2400 });
});

test("computeTargetSize: a photo already smaller than the limit is never enlarged", () => {
  assert.deepEqual(computeTargetSize(800, 600), { width: 800, height: 600 });
  assert.deepEqual(computeTargetSize(600, 800), { width: 600, height: 800 });
});

test("computeTargetSize: exactly at the limit on the larger side is left unchanged", () => {
  assert.deepEqual(computeTargetSize(2400, 1800), { width: 2400, height: 1800 });
  assert.deepEqual(computeTargetSize(1800, 2400), { width: 1800, height: 2400 });
  assert.deepEqual(computeTargetSize(2400, 2400), { width: 2400, height: 2400 });
});

test("computeTargetSize: custom maxSide is honoured", () => {
  assert.deepEqual(computeTargetSize(1000, 500, 200), { width: 200, height: 100 });
});

test("computeTargetSize: an extreme aspect ratio never rounds a side down to 0", () => {
  const r = computeTargetSize(10000, 1, 2400);
  assert.ok(r.height >= 1, `expected height >= 1, got ${r.height}`);
  assert.equal(r.width, 2400);
});

test("computeTargetSize: rejects non-finite or non-positive dimensions", () => {
  assert.throws(() => computeTargetSize(0, 100));
  assert.throws(() => computeTargetSize(100, -1));
  assert.throws(() => computeTargetSize(NaN, 100));
  assert.throws(() => computeTargetSize(100, Infinity));
});

test("toWebpFilename: replaces jpg/jpeg/png/webp extensions", () => {
  assert.equal(toWebpFilename("photo.jpg"), "photo.webp");
  assert.equal(toWebpFilename("photo.JPEG"), "photo.webp");
  assert.equal(toWebpFilename("photo.png"), "photo.webp");
  assert.equal(toWebpFilename("photo.webp"), "photo.webp");
});

test("toWebpFilename: keeps every earlier dot in a multi-dot filename, replaces only the last extension", () => {
  assert.equal(toWebpFilename("suzuki.sx4.v2.PNG"), "suzuki.sx4.v2.webp");
});

test("toWebpFilename: a filename with no extension gets .webp appended, not truncated", () => {
  assert.equal(toWebpFilename("no-extension"), "no-extension.webp");
});

test("isWebpMagicBytes: true for a real RIFF/WEBP header", () => {
  const header = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x00, 0x00, 0x00, 0x00, // file size (irrelevant to the check)
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    0x56, 0x50, 0x38, 0x20, // "VP8 " chunk (a real webp would have one)
  ]);
  assert.equal(isWebpMagicBytes(header), true);
});

test("isWebpMagicBytes: false for a JPEG header, a non-WEBP RIFF container, and a too-short buffer", () => {
  assert.equal(isWebpMagicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), false);
  const riffWave = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
  assert.equal(isWebpMagicBytes(riffWave), false);
  assert.equal(isWebpMagicBytes(new Uint8Array([0x52, 0x49, 0x46, 0x46])), false);
  assert.equal(isWebpMagicBytes(new Uint8Array(0)), false);
});

test("MAX_IMAGE_SIDE is 2400", () => {
  assert.equal(MAX_IMAGE_SIDE, 2400);
});
