/**
 * Resolves a car's `video` field to what the public site needs to render it:
 * which element to use, and a SAFE src for that element. Pure and
 * dependency-free (aside from the equally pure ../media/youtube) — kept out
 * of publishedCars.ts (which carries `import "server-only"`) specifically so
 * it is directly unit-testable without mocking that guard.
 */
import type { CmsCar } from "./carsGate";
import { looksLikeYoutubeUrl, parseYoutubeUrl } from "../media/youtube";

export interface ResolvedCarVideo {
  kind: "youtube" | "file";
  src: string;
  posterSrc: string;
}

/**
 * For a YouTube link, `src` is never the owner's raw pasted URL — it's the
 * normalized `youtube-nocookie.com/embed/<id>` address `parseYoutubeUrl`
 * built from a strictly-validated video id, so it can go straight into an
 * `<iframe src>` with no further checking at the call site. This only
 * classifies as "youtube" a link that would also pass the publish gate
 * (`carsGate.ts` blocks a spoofed/malformed YouTube-shaped link before it
 * ever reaches the published snapshot), so in practice this never falls
 * through to "file" for a car that made it through publishing — the
 * fallback exists for defense in depth, not because it's expected to fire.
 */
export function resolveCarVideo(
  car: Pick<CmsCar, "video">,
  toPublicImagePath: (s: string) => string,
): ResolvedCarVideo | null {
  const src = (car.video?.src ?? "").trim();
  const mode = car.video?.mode;
  if (!src || !(mode === "legacy-file" || mode === "external-link" || mode === "hosted-file")) {
    return null;
  }
  const posterSrc = toPublicImagePath(car.video.posterSrc);
  if (looksLikeYoutubeUrl(src)) {
    const parsed = parseYoutubeUrl(src);
    if (parsed.ok) return { kind: "youtube", src: parsed.embedUrl, posterSrc };
  }
  return { kind: "file", src, posterSrc };
}
