/**
 * Shared YouTube URL validation + normalization — the single place that
 * decides "is this a YouTube link" and "what is the safe embed URL for it".
 * Used by the publish gate (`carsGate.ts`, and through it `content-guard.ts`),
 * the public site's video embed (`publishedCars.ts` -> `CarListingGallery`),
 * and the panel's YouTube link helper (`/panel/video`) — one implementation,
 * not four copies that could drift.
 *
 * Pure and dependency-free (only the global `URL`), so it is safe to import
 * from server code, a plain node:test file, a "use client" component, and
 * `scripts/content-guard.ts` alike.
 */

/** Real YouTube hosts a pasted URL may use. Exact match only — never substring. */
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);

/** YouTube's own video id shape: 11 URL-safe base64 characters. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export type YoutubeParseResult =
  | { ok: true; videoId: string; embedUrl: string }
  | { ok: false; reason: string };

/**
 * The dot-separated label sequences that make a hostname "YouTube-shaped".
 * Matched at LABEL boundaries, not as a raw substring — `/youtu/i.test(host)`
 * used to flag anything containing those five letters anywhere, which wrongly
 * caught ordinary unrelated domains like `my-youtube-cdn.example` (single
 * label "my-youtube-cdn", never actually "youtube") or
 * `youtube-review-files.example`. Label-boundary matching only flags a
 * hostname that contains "youtube"+"com", "youtu"+"be", or
 * "youtube-nocookie"+"com" as ADJACENT, WHOLE labels — which is exactly the
 * domain-confusion pattern used to spoof YouTube (`youtube.com.evil.example`,
 * `www.youtube.com.example`, `youtu.be.evil.example` all contain one of
 * these sequences), while a hostname that merely has "youtube" baked into a
 * single compound label does not.
 */
const YOUTUBE_CORE_DOMAIN_LABELS: readonly (readonly string[])[] = [
  ["youtube", "com"],
  ["youtu", "be"],
  ["youtube-nocookie", "com"],
];

function containsLabelSequence(labels: readonly string[], seq: readonly string[]): boolean {
  for (let i = 0; i <= labels.length - seq.length; i++) {
    if (seq.every((label, j) => labels[i + j] === label)) return true;
  }
  return false;
}

/**
 * Loose heuristic ONLY: does this URL look like someone intended to paste a
 * YouTube link? Used purely to decide whether the strict check below applies
 * at all — an ordinary, unrelated https link (a direct MP4/WebM URL, a Blob
 * URL, a domain that merely happens to mention "youtube" as part of a
 * compound name) must keep working exactly as before, unexamined by YouTube
 * rules. A link that DOES look YouTube-shaped but fails the strict parse
 * below is rejected with a clear reason, rather than silently falling
 * through to "any https URL is fine" (which would let
 * `https://youtube.com.evil.example/` through as if it were real).
 */
export function looksLikeYoutubeUrl(input: string): boolean {
  const s = (input ?? "").trim();
  if (!s) return false;
  let hostname: string;
  try {
    hostname = new URL(s).hostname.toLowerCase();
  } catch {
    // Not even a parseable URL -- parseYoutubeUrl() will reject it as an
    // invalid URL regardless of this classification, so a coarse fallback
    // here changes nothing about the outcome, only which message path is
    // taken.
    return /youtu/i.test(s);
  }
  const labels = hostname.split(".");
  return YOUTUBE_CORE_DOMAIN_LABELS.some((seq) => containsLabelSequence(labels, seq));
}

/**
 * Strict parse: https only, an exact real YouTube host (no
 * `youtube.com.example.com`-style spoofing — hostname must match one of
 * `ALLOWED_HOSTS` exactly), and a well-formed 11-character video id from one
 * of the four supported URL shapes (`watch?v=`, `youtu.be/`, `/shorts/`,
 * `/embed/`). Never returns the caller's own URL as the embed address — it
 * always BUILDS a fresh `youtube-nocookie.com/embed/<id>` URL from the
 * validated id, so a value coming out of this function is safe to place
 * directly in an `<iframe src>` regardless of what the input looked like.
 */
export function parseYoutubeUrl(input: string): YoutubeParseResult {
  const s = (input ?? "").trim();
  if (!s) return { ok: false, reason: "порожнє посилання" };

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return { ok: false, reason: "некоректний URL" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "лише https-посилання" };
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, reason: `не є справжнім доменом YouTube (${host})` };
  }

  let videoId: string | null = null;
  if (host === "youtu.be") {
    videoId = url.pathname.slice(1).split("/")[0] || null;
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v");
  } else if (url.pathname.startsWith("/shorts/")) {
    videoId = url.pathname.slice("/shorts/".length).split("/")[0] || null;
  } else if (url.pathname.startsWith("/embed/")) {
    videoId = url.pathname.slice("/embed/".length).split("/")[0] || null;
  }

  if (!videoId || !VIDEO_ID_RE.test(videoId)) {
    return { ok: false, reason: "не вдалося визначити коректний ID відео в посиланні" };
  }

  return { ok: true, videoId, embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}` };
}

/** `"youtube"` when `src` is a valid YouTube link, else `"file"` (direct MP4/WebM/Blob/local path — unchanged handling). */
export function videoKindForSrc(src: string): "youtube" | "file" {
  return looksLikeYoutubeUrl(src) && parseYoutubeUrl(src).ok ? "youtube" : "file";
}
