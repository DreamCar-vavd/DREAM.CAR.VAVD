import { test } from "node:test";
import assert from "node:assert/strict";
import { detectContainer, imageDimensionsParse, sniffMedia, MAX_BYTES } from "./mediaSniff";

// --- byte fixtures -----------------------------------------------------------
const png1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cf000000030001010018dd8db00000000049454e44ae426082",
  "hex",
);
function jpegWithSof(w = 8, h = 8): Buffer {
  // SOI + APP0(JFIF) + a minimal SOF0 marker with real dimensions
  const sof = Buffer.from([
    0xff, 0xc0, 0x00, 0x11, 0x08, (h >> 8) & 0xff, h & 0xff, (w >> 8) & 0xff, w & 0xff, 0x03,
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02]), sof, Buffer.alloc(80)]);
}
const webpHeader = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
  Buffer.alloc(80),
]);
const mp4Header = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from("ftypmp42"),
  Buffer.alloc(80),
]);
const webmHeader = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(80)]);
const htmlBytes = Buffer.from("<!doctype html><html><script>alert(1)</script>".padEnd(200, " "));

// --- detection -------------------------------------------------------------
test("detectContainer recognises each real header", () => {
  assert.equal(detectContainer(png1x1), "png");
  assert.equal(detectContainer(jpegWithSof()), "jpeg");
  assert.equal(detectContainer(webpHeader), "webp");
  assert.equal(detectContainer(mp4Header), "mp4");
  assert.equal(detectContainer(webmHeader), "webm");
  assert.equal(detectContainer(htmlBytes), "unknown");
  assert.equal(detectContainer(Buffer.alloc(0)), "empty");
});

test("imageDimensionsParse needs a real SOF / IHDR, not just the signature", () => {
  assert.equal(imageDimensionsParse(png1x1), true);
  assert.equal(imageDimensionsParse(jpegWithSof(640, 480)), true);
  // JPEG signature but no SOF segment => not parseable
  assert.equal(imageDimensionsParse(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])), false);
});

// --- the gate --------------------------------------------------------------
test("a well-formed file whose extension matches its bytes passes", () => {
  assert.deepEqual(sniffMedia(png1x1, png1x1.length + 5000, "png"), { ok: true, detected: "png" });
  assert.deepEqual(sniffMedia(jpegWithSof(), 9000, ".jpg"), { ok: true, detected: "jpeg" });
  assert.deepEqual(sniffMedia(jpegWithSof(), 9000, "jpeg"), { ok: true, detected: "jpeg" });
  assert.deepEqual(sniffMedia(mp4Header, 500_000, "mp4"), { ok: true, detected: "mp4" });
});

test("extension / content mismatch is rejected and names both sides", () => {
  const r = sniffMedia(htmlBytes, 4000, "jpg");
  assert.equal(r.ok, false);
  assert.match(r.reason!, /вміст не розпізнано|вміст — /);

  const r2 = sniffMedia(png1x1, 8000, "mp4");
  assert.equal(r2.ok, false);
  assert.equal(r2.detected, "png");
  assert.match(r2.reason!, /png/);
});

test("empty, truncated and oversize files are rejected", () => {
  assert.equal(sniffMedia(Buffer.alloc(0), 0, "png").reason, "порожній файл (0 байт)");
  assert.match(sniffMedia(png1x1, 10, "png").reason!, /замалий/);
  assert.match(sniffMedia(png1x1, MAX_BYTES.image + 1, "png").reason!, /завеликий/);
  assert.match(sniffMedia(mp4Header, MAX_BYTES.video + 1, "mp4").reason!, /завеликий/);
});

test("a JPEG header with no frame data (truncated) is rejected even at a valid size", () => {
  const truncated = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0x00, 0x00]);
  const r = sniffMedia(truncated, 5000, "jpg");
  assert.equal(r.ok, false);
  assert.match(r.reason!, /розміри зображення не читаються/);
});

test("an unknown / disallowed extension is rejected up front", () => {
  assert.match(sniffMedia(png1x1, 5000, "svg").reason!, /непідтримуване розширення/);
  assert.match(sniffMedia(png1x1, 5000, "gif").reason!, /непідтримуване розширення/);
});
