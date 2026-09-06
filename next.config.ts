import type { NextConfig } from "next";

/**
 * Public site CSP — unchanged from before the panel. Strict: no external
 * origins at all.
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
  frame-src 'none';
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
 *    avatars.githubusercontent.com — required only in GitHub storage mode
 *    (hosted panel): the API calls that read/write content and the sign-in
 *    redirect. Harmless in local mode.
 * `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` are kept
 * exactly as strict as the public site. `'unsafe-eval'` is added to
 * `script-src` ONLY in development (`next dev`) — React's dev build needs it
 * and Keystatic's editor overlay is otherwise unusable locally; `next build`
 * output does not need it (verified) so production `script-src` stays strict.
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
  img-src 'self' data: blob: https://avatars.githubusercontent.com;
  font-src 'self' data: https://fonts.gstatic.com;
  media-src 'self' blob:;
  connect-src 'self' https://api.github.com https://github.com;
  frame-src 'none';
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
