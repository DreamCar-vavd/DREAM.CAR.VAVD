export type ContactErrorKind = "notConfigured" | "timeout" | "rateLimited" | "generic";

/**
 * Classifies a non-ok `/api/contact` response into the error kind the UI
 * should show, from the HTTP status and (if present) the parsed `code`
 * field. `429` is recognized purely from the status code so a rate-limit
 * response is still classified correctly even when the body isn't the
 * route's own JSON — e.g. an HTML challenge page or an empty body from a
 * WAF/edge rule in front of the route.
 *
 * Client-safe by design: unlike the rest of `src/lib/contact.ts`, this
 * runs in the browser (`ContactForm.tsx` calls it after `fetch`), so it
 * must not import anything server-only.
 */
export function classifyContactErrorKind(
  status: number,
  code: string | null | undefined,
): ContactErrorKind {
  if (status === 429) return "rateLimited";
  if (code === "NOT_CONFIGURED") return "notConfigured";
  if (code === "UPSTREAM_TIMEOUT") return "timeout";
  return "generic";
}
