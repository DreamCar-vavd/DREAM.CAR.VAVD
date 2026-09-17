import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeYoutubeUrl, parseYoutubeUrl, videoKindForSrc } from "./youtube";

const ID = "dQw4w9WgXcQ"; // a real, well-known 11-char YouTube video id shape

test("parseYoutubeUrl: all four supported formats normalize to the same embed URL", () => {
  const expected = `https://www.youtube-nocookie.com/embed/${ID}`;
  for (const url of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
  ]) {
    const r = parseYoutubeUrl(url);
    assert.equal(r.ok, true, `expected ${url} to parse`);
    if (r.ok) {
      assert.equal(r.videoId, ID);
      assert.equal(r.embedUrl, expected);
    }
  }
});

test("parseYoutubeUrl: watch URL with extra query params (playlist, timestamp) still extracts v=", () => {
  const r = parseYoutubeUrl(`https://www.youtube.com/watch?list=PL123&v=${ID}&t=42s`);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.videoId, ID);
});

test("parseYoutubeUrl: m.youtube.com and youtube-nocookie.com are accepted as real hosts", () => {
  assert.equal(parseYoutubeUrl(`https://m.youtube.com/watch?v=${ID}`).ok, true);
  assert.equal(parseYoutubeUrl(`https://www.youtube-nocookie.com/embed/${ID}`).ok, true);
});

test("parseYoutubeUrl: rejects spoofed/lookalike domains (not a valid URL, or a valid URL with the wrong host), never falling through to 'any https URL is fine'", () => {
  for (const bad of [
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://youtube.com.example.com/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    `https://youtu.be.evil.example/${ID}`,
  ]) {
    const r = parseYoutubeUrl(bad);
    assert.equal(r.ok, false, `expected ${bad} to be rejected`);
    if (!r.ok) assert.match(r.reason, /домен/, `expected a host-mismatch reason for ${bad}, got: ${r.reason}`);
  }
  // A syntactically-invalid punycode host is rejected too, just via a
  // different code path (new URL() itself throws) -- still `ok: false`.
  assert.equal(parseYoutubeUrl(`https://xn--youtube-com.example/watch?v=${ID}`).ok, false);
});

test("parseYoutubeUrl: rejects non-https (http, data:, javascript:)", () => {
  assert.equal(parseYoutubeUrl(`http://www.youtube.com/watch?v=${ID}`).ok, false);
  assert.equal(parseYoutubeUrl("javascript:alert(1)").ok, false);
  assert.equal(parseYoutubeUrl("data:text/html,<script>alert(1)</script>").ok, false);
});

test("parseYoutubeUrl: rejects malformed/missing video ids", () => {
  assert.equal(parseYoutubeUrl("https://www.youtube.com/watch?v=").ok, false);
  assert.equal(parseYoutubeUrl("https://www.youtube.com/watch?v=short").ok, false);
  assert.equal(parseYoutubeUrl("https://www.youtube.com/watch?v=way-too-long-id-here").ok, false);
  assert.equal(parseYoutubeUrl("https://youtu.be/").ok, false);
  assert.equal(parseYoutubeUrl("https://www.youtube.com/").ok, false);
  assert.equal(parseYoutubeUrl("https://www.youtube.com/channel/UC123456789").ok, false);
});

test("parseYoutubeUrl: rejects empty and garbage input", () => {
  assert.equal(parseYoutubeUrl("").ok, false);
  assert.equal(parseYoutubeUrl("   ").ok, false);
  assert.equal(parseYoutubeUrl("not a url at all").ok, false);
});

test("looksLikeYoutubeUrl: true for anything youtube-shaped, including spoofed domains (that's the point)", () => {
  assert.equal(looksLikeYoutubeUrl(`https://www.youtube.com/watch?v=${ID}`), true);
  assert.equal(looksLikeYoutubeUrl(`https://youtube.com.evil.example/watch?v=${ID}`), true);
  assert.equal(looksLikeYoutubeUrl(`https://youtu.be/${ID}`), true);
});

test("looksLikeYoutubeUrl: false for ordinary, unrelated links (direct files, Blob, empty)", () => {
  assert.equal(looksLikeYoutubeUrl("https://blob.vercel-storage.com/panel/videos/x.mp4"), false);
  assert.equal(looksLikeYoutubeUrl("/uploads/videos/abc12345-clip.mp4"), false);
  assert.equal(looksLikeYoutubeUrl(""), false);
  assert.equal(looksLikeYoutubeUrl("https://vimeo.com/12345"), false);
});

test("videoKindForSrc: 'youtube' only for a genuinely valid YouTube link", () => {
  assert.equal(videoKindForSrc(`https://www.youtube.com/watch?v=${ID}`), "youtube");
  assert.equal(videoKindForSrc(`https://youtu.be/${ID}`), "youtube");
});

test("videoKindForSrc: 'file' for direct video links, Blob URLs, local paths, and rejected YouTube-shaped links", () => {
  assert.equal(videoKindForSrc("https://blob.vercel-storage.com/panel/videos/x.mp4"), "file");
  assert.equal(videoKindForSrc("/uploads/videos/abc12345-clip.mp4"), "file");
  assert.equal(videoKindForSrc("https://youtube.com.evil.example/watch?v=" + ID), "file");
  assert.equal(videoKindForSrc(""), "file");
});
