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
  assert.equal(result?.youtubeWatchUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
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
    assert.equal(result?.youtubeWatchUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  }
});

test("resolveCarVideo: every supported YouTube form (watch / youtu.be / shorts / embed, any allowed host) gives one embed src and one watch URL", () => {
  for (const src of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "  https://youtu.be/dQw4w9WgXcQ  ",
  ]) {
    const result = resolveCarVideo(car({ mode: "external-link", src, posterSrc: "" }), path);
    assert.deepEqual(
      result,
      {
        kind: "youtube",
        src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        posterSrc: "",
        youtubeWatchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      src,
    );
  }
});

test("resolveCarVideo: the live car links (Shorts with a leading '-' in the id) give the normalized embed + watch URLs", () => {
  const a = resolveCarVideo(car({ mode: "external-link", src: "https://youtube.com/shorts/5dcXCcJHBEY", posterSrc: "" }), path);
  assert.equal(a?.src, "https://www.youtube-nocookie.com/embed/5dcXCcJHBEY");
  assert.equal(a?.youtubeWatchUrl, "https://www.youtube.com/watch?v=5dcXCcJHBEY");
  const b = resolveCarVideo(car({ mode: "external-link", src: "https://youtube.com/shorts/-S-RDZEOX7U", posterSrc: "" }), path);
  assert.equal(b?.src, "https://www.youtube-nocookie.com/embed/-S-RDZEOX7U");
  assert.equal(b?.youtubeWatchUrl, "https://www.youtube.com/watch?v=-S-RDZEOX7U");
});

test("resolveCarVideo: a direct MP4/WebM external-link resolves to kind 'file' with the src unchanged", () => {
  const result = resolveCarVideo(
    car({ mode: "external-link", src: "https://cdn.example.com/reviews/clip.mp4", posterSrc: "" }),
    path,
  );
  assert.equal(result?.kind, "file");
  assert.equal(result?.src, "https://cdn.example.com/reviews/clip.mp4");
  assert.equal(result?.youtubeWatchUrl, null);
});

test("resolveCarVideo: hosted-file (Blob upload) resolves to kind 'file', src unchanged", () => {
  const result = resolveCarVideo(
    car({ mode: "hosted-file", src: "https://blob.vercel-storage.com/panel/videos/x.mp4", posterSrc: "" }),
    path,
  );
  assert.equal(result?.kind, "file");
  assert.equal(result?.src, "https://blob.vercel-storage.com/panel/videos/x.mp4");
  assert.equal(result?.youtubeWatchUrl, null);
});

test("resolveCarVideo: legacy-file resolves to kind 'file', src unchanged", () => {
  const result = resolveCarVideo(
    car({ mode: "legacy-file", src: "/images/cms/cars/c1/video/x.mp4", posterSrc: "" }),
    path,
  );
  assert.equal(result?.kind, "file");
  assert.equal(result?.src, "/images/cms/cars/c1/video/x.mp4");
  assert.equal(result?.youtubeWatchUrl, null);
});

test("resolveCarVideo: a spoofed YouTube-shaped external-link falls back to kind 'file' (defense in depth — the publish gate is the real blocker)", () => {
  const result = resolveCarVideo(
    car({ mode: "external-link", src: "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", posterSrc: "" }),
    path,
  );
  assert.equal(result?.kind, "file");
  assert.equal(result?.src, "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ");
  assert.equal(result?.youtubeWatchUrl, null);
});

test("resolveCarVideo: spoofed or malformed YouTube-shaped links never produce an active watch URL", () => {
  for (const src of [
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com.example/watch?v=dQw4w9WgXcQ",
    "https://youtu.be.evil.example/dQw4w9WgXcQ",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload",
    "https://youtu.be/",
    "https://www.youtube.com/channel/UC123",
    "javascript:alert(1)//youtube.com",
  ]) {
    const result = resolveCarVideo(car({ mode: "external-link", src, posterSrc: "" }), path);
    assert.notEqual(result?.kind, "youtube", src);
    assert.equal(result?.youtubeWatchUrl ?? null, null, src);
  }
});

test("resolveCarVideo: an ordinary https video file is still handled as before — kind 'file', src unchanged, no watch URL", () => {
  for (const src of [
    "https://cdn.example.com/clip.webm",
    "https://my-youtube-cdn.example/clip.mp4",
  ]) {
    const result = resolveCarVideo(car({ mode: "external-link", src, posterSrc: "" }), path);
    assert.deepEqual(result, { kind: "file", src, posterSrc: "", youtubeWatchUrl: null }, src);
  }
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
