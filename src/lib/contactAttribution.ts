import { CONTACT_MAX_LENGTHS } from "./contactLimits";

/**
 * Where a contact-form enquiry came from: the page path and the five
 * standard UTM campaign tags, read once from the current URL. Shared by the
 * client form (which reads `window.location.href`) and the server (which
 * re-validates whatever the browser sends).
 *
 * Deliberately NOT collected: referrer, IP, click ids (`gclid`, `fbclid`,
 * ...) or any other query parameter. Nothing here touches cookies or
 * browser storage — the result only lives in memory until the form is sent.
 */
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export type ContactAttributionFields = { pagePath?: string } & Partial<Record<UtmKey, string>>;

// C0 controls (incl. CR/LF and TAB) and DEL.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** A same-site path: starts with a single "/", no query, hash or control chars. */
export function isSafePagePath(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[?#\\]/.test(value) &&
    !CONTROL_CHARS.test(value) &&
    value.length <= CONTACT_MAX_LENGTHS.pagePath
  );
}

/** A UTM value worth forwarding: non-empty, short, no control chars. */
export function isSafeUtmValue(value: string): boolean {
  return value.length > 0 && value.length <= CONTACT_MAX_LENGTHS.utm && !CONTROL_CHARS.test(value);
}

/**
 * Extracts `pagePath` (pathname only — never the domain, query or hash) and
 * the allowed UTM tags from a URL. Values that are empty, too long or
 * contain control characters are dropped rather than truncated, so the
 * server never receives something it would reject.
 */
export function extractContactAttribution(href: string): ContactAttributionFields {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return {};
  }

  const result: ContactAttributionFields = {};

  const pagePath = url.pathname.trim();
  if (isSafePagePath(pagePath)) result.pagePath = pagePath;

  for (const key of UTM_KEYS) {
    const value = (url.searchParams.get(key) ?? "").trim();
    if (isSafeUtmValue(value)) result[key] = value;
  }

  return result;
}
