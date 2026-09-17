import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCarVideo } from "./carVideo";
import type { CmsCar } from "./carsGate";

const path = (s: string) => (s ? `/images/cms/cars/${s}` : "");

function car(video: CmsCar["video"]): Pick<CmsCar, "video"> {
  return { video };
}

test("resolveCarVideo: YouTube external-link resolves to kind 'youtube' with a normalized embed src, never the raw URL", () => {
  const result = resolveCarVideo(
    car({ mode: "external-link", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", posterSrc: "p.jpg" }),
    path,
  );
  assert.ok(result);
  assert.equal(result?.kind, "youtube");
  assert.equal(result?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.notEqual(result?.src, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(result?.posterSrc, "/images/cms/cars/p.jpg");
});

test("resolveCarVideo: youtu.be / shorts / embed forms all resolve to the same normalized 'youtube' kind", () => {
  for (const src of [
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ]) {
    const result = resolveCarVideo(car({ mode: "external-link", src, posterSrc: "" }), path);
    assert.equal(result?.kind, "youtube");
    assert.equal(result?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  }
});

test("resolveCarVideo: a direct MP4/WebM external-link resolves to kind 'file' with the src unchanged", () => {
  const result = resolveCarVideo(
    car({ mode: "external-link", src: "https://cdn.example.com/reviews/clip.mp4", posterSrc: "" }),
    path,
  );
  assert.equal(result?.kind, "file");
  assert.equal(result?.src, "https://cdn.example.com/reviews/clip.mp4");
});

test("resolveCarVideo: hosted-file (Blob upload) resolves to kind 'file', src unchanged", () => {
  const result = resolveCarVideo(
    car({ mode: "hosted-file", src: "https://blob.vercel-storage.com/panel/videos/x.mp4", posterSrc: "" }),
    path,
  );
  assert.equal(result?.kind, "file");
  assert.equal(result?.src, "https://blob.vercel-storage.com/panel/videos/x.mp4");
});

test("resolveCarVideo: legacy-file resolves to kind 'file', src unchanged", () => {
  const result = resolveCarVideo(
    car({ mode: "legacy-file", src: "/images/cms/cars/c1/video/x.mp4", posterSrc: "" }),
    path,
  );
  assert.equal(result?.kind, "file");
  assert.equal(result?.src, "/images/cms/cars/c1/video/x.mp4");
});

test("resolveCarVideo: a spoofed YouTube-shaped external-link falls back to kind 'file' (defense in depth — the publish gate is the real blocker)", () => {
  const result = resolveCarVideo(
    car({ mode: "external-link", src: "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", posterSrc: "" }),
    path,
  );
  assert.equal(result?.kind, "file");
  assert.equal(result?.src, "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ");
});

test("resolveCarVideo: mode 'none', 'uploaded-file', or empty src all resolve to null", () => {
  assert.equal(resolveCarVideo(car({ mode: "none", src: "", posterSrc: "" }), path), null);
  assert.equal(
    resolveCarVideo(car({ mode: "uploaded-file", src: "", posterSrc: "" }), path),
    null,
  );
  assert.equal(
    resolveCarVideo(car({ mode: "external-link", src: "", posterSrc: "" }), path),
    null,
  );
});
