/**
 * The management panel routes (`/keystatic`, `/api/keystatic`) are active only:
 *  - in local development (`next dev`), where Keystatic's `local` storage mode
 *    reads/writes files on your machine, OR
 *  - on a deployment that has been explicitly switched to GitHub storage mode
 *    (`KEYSTATIC_STORAGE_KIND=github`) — which also brings real GitHub sign-in.
 *
 * On any other deployment (e.g. this PR's Vercel Preview with no env set) the
 * routes return 404. This is deliberate: Keystatic's `local` mode has no
 * authentication and cannot write to a read-only serverless filesystem, so it
 * must never be reachable as a public URL.
 */
export const keystaticEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.KEYSTATIC_STORAGE_KIND === "github";
