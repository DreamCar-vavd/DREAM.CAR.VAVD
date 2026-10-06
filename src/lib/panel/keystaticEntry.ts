import { resolveContentBranch } from "@/lib/content/store/branch";

/** Where a visitor goes when there is no usable content branch — never `main`. */
export const PANEL_FALLBACK_PATH = "/panel";

/**
 * Server-side gate for full page loads of the Keystatic editor (`/keystatic…`).
 *
 * In GitHub storage mode Keystatic's own root route jumps to the repository's
 * default branch (`main`), and its in-app router only uses `history.pushState`,
 * so it never asks the server again. The proxy therefore calls this on every
 * full load and redirects to the returned path; `null` lets the request through.
 *  - local storage mode: always `null` (there are no branches);
 *  - `/keystatic`, `/keystatic/branch`: the allowed content branch;
 *  - `/keystatic/branch/<other>` (incl. `main`): the allowed branch's root — the
 *    rest of the path is dropped on purpose;
 *  - the allowed branch itself: `null`, whether its slash arrives encoded
 *    (`panel%2Fcontent`) or split (`panel/content`), so the redirect cannot loop;
 *  - Keystatic's own pages (`/keystatic/setup`, `/keystatic/repo-not-found`, …): `null`;
 *  - no usable branch (undefined or forbidden — see `resolveContentBranch`): `/panel`.
 */
export function keystaticEntryRedirect(
  pathname: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND !== "github") return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "keystatic") return null;
  if (segments.length > 1 && segments[1] !== "branch") return null;

  const resolved = resolveContentBranch(env);
  if (resolved.branch === null) return PANEL_FALLBACK_PATH;

  const allowedRoot = `/keystatic/branch/${encodeURIComponent(resolved.branch)}`;
  if (segments.length < 3) return allowedRoot;
  return startsWithBranch(segments.slice(2), resolved.branch) ? null : allowedRoot;
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function startsWithBranch(rest: string[], branch: string): boolean {
  if (decodeSegment(rest[0]) === branch) return true;
  const parts = branch.split("/");
  return rest.length >= parts.length && parts.every((part, i) => decodeSegment(rest[i]) === part);
}
