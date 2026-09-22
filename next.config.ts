import type { NextConfig } from "next";

/**
 * Public site CSP. One deliberate addition beyond the pre-panel baseline:
 * `frame-src` allows ONLY `youtube-nocookie.com` — required for a car's
 * YouTube video embed (`CarListingGallery`'s iframe). That iframe's `src`
 * is never the owner's raw pasted URL; it is always a
 * `youtube-nocookie.com/embed/<id>` address built by
 * `src/lib/content/carVideo.ts` from a strictly-validated video id (see
 * `src/lib/media/youtube.ts`), so this CSP entry can only ever load a real
 * YouTube embed, never an arbitrary attacker-chosen frame. No other origin
 * is added anywhere else in this policy.
 */
const publicCsp = `
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  media-src 'self' blob:;
  connect-src 'self';
  frame-src https://www.youtube-nocookie.com;
  worker-src 'none';
  manifest-src 'self';
`
  .replace(/\s{2,}/g, " ")
  .trim();

/**
 * CSP for the management panel routes only (`/keystatic`, `/api/keystatic`).
 * Never sent for a public page.
 *
 * Deltas vs the public CSP, each tied to an observed need on `next build` +
 * `next start` (see report/33 §5):
 *  - style-src / font-src add Google Fonts — Keystatic's admin UI loads the
 *    Inter webfont from fonts.googleapis.com. Blocked -> UI renders in a
 *    fallback font (still usable), so this is cosmetic; added to remove the
 *    console error.
 *  - connect-src / img-src / form-action add api.github.com + github.com +
 *    avatars.githubusercontent.com + raw.githubusercontent.com — required only
 *    in GitHub storage mode (hosted panel): api.github.com is the GraphQL/REST
 *    API (dashboard + collection lists + writes); raw.githubusercontent.com is
 *    how Keystatic's item editor fetches a single file's content and image
 *    blobs (@keystatic/core keystatic-core-ui.js) — without it every item
 *    editor shows "TypeError: Failed to fetch"; github.com is the sign-in
 *    redirect. Harmless in local mode.
 * `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` are kept
 * exactly as strict as the public site. `'unsafe-eval'` is added to
 * `script-src` ONLY in development (`next dev`) — React's dev build needs it
 * and Keystatic's editor overlay is otherwise unusable locally; `next build`
 * output does not need it (verified) so production `script-src` stays strict.
 *  - frame-src adds youtube-nocookie.com — same reasoning as the public CSP
 *    above: `/panel/video`'s YoutubeLinkHelper shows a live preview iframe
 *    of the pasted link before the owner copies it into Keystatic, built
 *    from the same strictly-validated embed URL, never the raw input.
 */
const devUnsafeEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
const panelCsp = `
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  frame-ancestors 'none';
  form-action 'self' https://github.com;
  script-src 'self' 'unsafe-inline'${devUnsafeEval};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https://avatars.githubusercontent.com https://raw.githubusercontent.com;
  font-src 'self' data: https://fonts.gstatic.com;
  media-src 'self' blob:;
  connect-src 'self' https://api.github.com https://github.com https://raw.githubusercontent.com;
  frame-src https://www.youtube-nocookie.com;
  worker-src 'none';
  manifest-src 'self';
`
  .replace(/\s{2,}/g, " ")
  .trim();

const sharedHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    qualities: [75, 90],
  },
  experimental: {
    globalNotFound: true,
  },
  async headers() {
    return [
      {
        // Every route EXCEPT the management panel — keeps the strict public CSP.
        source: "/((?!keystatic|api/keystatic|panel|api/panel).*)",
        headers: [...sharedHeaders, { key: "Content-Security-Policy", value: publicCsp }],
      },
      ...["/keystatic/:path*", "/api/keystatic/:path*", "/panel/:path*", "/api/panel/:path*"].map(
        (source) => ({
          source,
          headers: [...sharedHeaders, { key: "Content-Security-Policy", value: panelCsp }],
        }),
      ),
    ];
  },
};

export default nextConfig;
