/**
 * Publish gate for the site Contacts + schedule. One entry (`site`); modelled
 * as a 1-row collection so it uses the same pipeline as everything else.
 *
 * The technical submission recipient (CONTACT_FORM_ENDPOINT) is NOT here — it
 * stays an environment variable. Editing the public email never changes it.
 */
import {
  LOCALES,
  reviewInstanceMatches,
  type ContentLocale,
  type GateContext,
  type GateFailure,
  type LangReviewStatus,
} from "./carsGate";

export interface CmsContactLanguage {
  heading: string;
  subheading: string;
  hoursLabel: string;
  addressLabel: string;
}
export interface CmsContact {
  id: string; // always "site"
  order: number;
  phoneDisplay: string;
  phoneE164: string;
  email: string;
  whatsappNumber: string;
  telegramUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  addressText: string;
  mapsUrl: string;
  hours: string;
  uk: CmsContactLanguage;
  en: CmsContactLanguage;
  ru: CmsContactLanguage;
}

const REQUIRED_LANG = ["heading", "subheading"] as const;

/** Allowed hosts for each social / map URL field. */
const URL_HOSTS: Record<string, RegExp> = {
  telegramUrl: /^(t\.me|telegram\.me)$/i,
  instagramUrl: /^(www\.)?instagram\.com$/i,
  facebookUrl: /^(www\.)?(facebook\.com|fb\.com|m\.facebook\.com)$/i,
  youtubeUrl: /^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)$/i,
  mapsUrl: /^(www\.)?(google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+)$/i,
};

export function isSafeUrl(field: string, value: string): boolean {
  const v = value.trim();
  if (!v) return true; // empty optional field is fine
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = URL_HOSTS[field];
  return host ? host.test(u.hostname) : false;
}

export function isValidPhone(v: string): boolean {
  const t = v.trim();
  return t === "" || /^\+?[0-9][0-9 ()\-]{6,19}$/.test(t);
}
export function isValidEmail(v: string): boolean {
  const t = v.trim();
  return t === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t);
}

/** Fields whose change invalidates a prior review. */
export function contactConfirmedText(l: CmsContactLanguage): string {
  return JSON.stringify({
    heading: (l?.heading ?? "").trim(),
    subheading: (l?.subheading ?? "").trim(),
    hoursLabel: (l?.hoursLabel ?? "").trim(),
    addressLabel: (l?.addressLabel ?? "").trim(),
  });
}

export function getContactLangStatus(
  c: CmsContact,
  locale: ContentLocale,
  ctx: GateContext = {},
): LangReviewStatus {
  const l = c[locale];
  if (!REQUIRED_LANG.every((f) => String(l?.[f] ?? "").trim())) return "empty";
  const confirmedHash = ctx.review?.[c.id]?.[locale]?.hash;
  if (confirmedHash === undefined) return "needs-review";
  if (!reviewInstanceMatches(ctx, c.id)) return "needs-review";
  if (ctx.sha256 && confirmedHash !== ctx.sha256(contactConfirmedText(l))) return "needs-review";
  return "reviewed";
}

export function getContactPublishBlockers(c: CmsContact, ctx: GateContext = {}): GateFailure[] {
  const failures: GateFailure[] = [];
  // Contacts are one record with a fixed id. Anything else must not publish —
  // it would be a second, conflicting contact set.
  if (c.id !== "site") {
    failures.push({ kind: "missing-field", locale: "uk", field: "contactId" });
  }
  if (c.phoneDisplay?.trim() && !isValidPhone(c.phoneDisplay)) {
    failures.push({ kind: "missing-field", locale: "uk", field: "phoneDisplay" });
  }
  if (c.phoneE164?.trim() && !isValidPhone(c.phoneE164)) {
    failures.push({ kind: "missing-field", locale: "uk", field: "phoneE164" });
  }
  if (c.email?.trim() && !isValidEmail(c.email)) {
    failures.push({ kind: "missing-field", locale: "uk", field: "email" });
  }
  for (const field of Object.keys(URL_HOSTS)) {
    if (!isSafeUrl(field, String(c[field as keyof CmsContact] ?? ""))) {
      failures.push({ kind: "missing-field", locale: "uk", field });
    }
  }
  for (const locale of LOCALES) {
    for (const field of REQUIRED_LANG) {
      if (!String(c[locale]?.[field] ?? "").trim()) {
        failures.push({ kind: "missing-field", locale, field });
      }
    }
    const filled = REQUIRED_LANG.every((f) => String(c[locale]?.[f] ?? "").trim());
    if (filled && getContactLangStatus(c, locale, ctx) !== "reviewed") {
      failures.push({ kind: "needs-review", locale });
    }
  }
  return failures;
}

export function isContactRenderable(): boolean {
  return true;
}
