import { CONTACT_MAX_LENGTHS } from "./contactLimits";
import { UTM_KEYS, isSafePagePath, isSafeUtmValue, type UtmKey } from "./contactAttribution";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s()-]{6,}$/;

export { CONTACT_MAX_LENGTHS };

export interface NormalizedContactInput {
  name: string;
  phone: string;
  email: string;
  service: string;
  vehicle: string;
  message: string;
  consent: boolean;
  website: string;
  locale: string;
  pagePath: string;
  serviceLabel: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
}

export interface ContactPayload {
  name: string;
  phone: string;
  email: string;
  service: string;
  vehicle: string;
  message: string;
  consent: true;
}

export const CONTACT_LOCALES = ["uk", "en", "ru"] as const;
export type ContactLocale = (typeof CONTACT_LOCALES)[number];

/**
 * Optional metadata about where an enquiry came from. Every field is
 * optional so an older payload without it stays valid. It goes to the
 * email only — never to the leads database (see `toLeadInput`).
 */
export type ContactAttribution = {
  locale?: ContactLocale;
  pagePath?: string;
  serviceLabel?: string;
} & Partial<Record<UtmKey, string>>;

export type ContactValidationResult =
  | { valid: true; payload: ContactPayload; attribution: ContactAttribution }
  | { valid: false; reason: string };

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type ReadLimitedBodyResult = { ok: true; text: string } | { ok: false; reason: "too_large" };

/**
 * Reads a Request body up to `maxBytes` without ever buffering more than
 * that limit in memory. Cancels the stream as soon as the limit is
 * exceeded instead of reading the whole body first and checking after.
 */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<ReadLimitedBodyResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  const body = request.body;
  if (!body) {
    return { ok: true, text: "" };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(combined) };
}

/**
 * Validates a server-configured delivery endpoint. Only a well-formed
 * `https:` URL is accepted; anything empty, malformed, or on another
 * protocol is treated as "not configured".
 */
export function resolveAllowedEndpoint(rawValue: string | undefined): URL | null {
  if (!rawValue) return null;
  try {
    const parsed = new URL(rawValue);
    return parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Checks a `Content-Type` header value for an exact `application/json`
 * media type (an optional `;charset=...` parameter is allowed). Unlike a
 * plain `.includes("application/json")` check, this rejects media types
 * that merely contain that substring, e.g. `text/application/json` or
 * `application/json-fake`.
 */
export function isJsonContentType(contentType: string): boolean {
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

export type OriginCheckResult = "same-origin" | "cross-origin" | "unknown";

/**
 * Evaluates whether a request's `Origin` (and, as a secondary signal,
 * `Sec-Fetch-Site`) header indicates it came from the site's own origin.
 *
 * A missing `Origin` header is deliberately classified as `"unknown"`
 * rather than `"cross-origin"`: same-origin requests aren't guaranteed to
 * carry an `Origin` header from every client, and treating an absent
 * header as hostile would risk rejecting legitimate same-origin
 * submissions with no corresponding security benefit (a forged request
 * can omit the header just as easily as a real one).
 */
export function evaluateRequestOrigin(
  originHeader: string | null,
  secFetchSite: string | null,
  siteOrigin: string,
): OriginCheckResult {
  if (secFetchSite === "cross-site") return "cross-origin";

  if (originHeader) {
    try {
      return new URL(originHeader).origin === siteOrigin ? "same-origin" : "cross-origin";
    } catch {
      return "cross-origin";
    }
  }

  return "unknown";
}

/**
 * Extracts only the known contact-form fields from an arbitrary parsed JSON
 * body. Anything else in the input is discarded.
 */
export function normalizeContactInput(raw: unknown): NormalizedContactInput {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    name: readString(source.name),
    phone: readString(source.phone),
    email: readString(source.email),
    service: readString(source.service),
    vehicle: readString(source.vehicle),
    message: readString(source.message),
    consent: source.consent === true,
    website: readString(source.website),
    locale: readString(source.locale),
    pagePath: readString(source.pagePath),
    serviceLabel: readString(source.serviceLabel),
    utm_source: readString(source.utm_source),
    utm_medium: readString(source.utm_medium),
    utm_campaign: readString(source.utm_campaign),
    utm_content: readString(source.utm_content),
    utm_term: readString(source.utm_term),
  };
}

export function isHoneypotTriggered(input: NormalizedContactInput): boolean {
  return input.website.length > 0;
}

export function validateContactPayload(input: NormalizedContactInput): ContactValidationResult {
  if (!input.name) return { valid: false, reason: "name is required" };
  if (input.name.length > CONTACT_MAX_LENGTHS.name) return { valid: false, reason: "name too long" };

  if (!input.phone) return { valid: false, reason: "phone is required" };
  if (input.phone.length > CONTACT_MAX_LENGTHS.phone) return { valid: false, reason: "phone too long" };
  if (!PHONE_PATTERN.test(input.phone)) return { valid: false, reason: "phone is invalid" };

  if (input.email) {
    if (input.email.length > CONTACT_MAX_LENGTHS.email) return { valid: false, reason: "email too long" };
    if (!EMAIL_PATTERN.test(input.email)) return { valid: false, reason: "email is invalid" };
  }

  if (input.service.length > CONTACT_MAX_LENGTHS.service) {
    return { valid: false, reason: "service too long" };
  }

  if (input.vehicle.length > CONTACT_MAX_LENGTHS.vehicle) {
    return { valid: false, reason: "vehicle too long" };
  }

  if (!input.message) return { valid: false, reason: "message is required" };
  if (input.message.length > CONTACT_MAX_LENGTHS.message) {
    return { valid: false, reason: "message too long" };
  }

  if (input.consent !== true) return { valid: false, reason: "consent is required" };

  const attribution: ContactAttribution = {};

  if (input.locale) {
    if (!(CONTACT_LOCALES as readonly string[]).includes(input.locale)) {
      return { valid: false, reason: "locale is invalid" };
    }
    attribution.locale = input.locale as ContactLocale;
  }

  if (input.pagePath) {
    if (!isSafePagePath(input.pagePath)) return { valid: false, reason: "pagePath is invalid" };
    attribution.pagePath = input.pagePath;
  }

  // The label is the visible option text, so it only means something next
  // to a chosen service. Line breaks and other control characters are
  // flattened to spaces: it ends up in the email subject.
  const serviceLabel = input.service ? sanitizeSingleLine(input.serviceLabel) : "";
  if (serviceLabel.length > CONTACT_MAX_LENGTHS.serviceLabel) {
    return { valid: false, reason: "serviceLabel too long" };
  }
  if (serviceLabel) attribution.serviceLabel = serviceLabel;

  for (const key of UTM_KEYS) {
    const value = input[key];
    if (!value) continue;
    if (!isSafeUtmValue(value)) return { valid: false, reason: `${key} is invalid` };
    attribution[key] = value;
  }

  return {
    valid: true,
    payload: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      service: input.service,
      vehicle: input.vehicle,
      message: input.message,
      consent: true,
    },
    attribution,
  };
}

function sanitizeSingleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

const SUBJECT_TEXT: Record<ContactLocale, { tag: string; withService: string; plain: string }> = {
  uk: { tag: "[UK]", withService: "нова заявка", plain: "Нова заявка" },
  en: { tag: "[EN]", withService: "new enquiry", plain: "New enquiry" },
  ru: { tag: "[RU]", withService: "новая заявка", plain: "Новая заявка" },
};

/**
 * The email subject is always built here on the server from validated
 * fields — a subject sent by the browser is never trusted.
 */
export function buildContactSubject(attribution: ContactAttribution): string {
  if (!attribution.locale) return "DREAM.CAR.VAVD — New enquiry";
  const text = SUBJECT_TEXT[attribution.locale];
  const subject = attribution.serviceLabel
    ? `${text.tag} ${attribution.serviceLabel} — ${text.withService}`
    : `${text.tag} ${text.plain}`;
  return subject.slice(0, CONTACT_MAX_LENGTHS.subject);
}

/** Exactly the fields the leads database stores — no attribution. */
export function toLeadInput(payload: ContactPayload) {
  return {
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    service: payload.service,
    vehicle: payload.vehicle,
    message: payload.message,
  };
}

/** The JSON sent to the email provider: the lead, its attribution and the subject. */
export function buildEmailPayload(payload: ContactPayload, attribution: ContactAttribution) {
  const email: Record<string, string | boolean> = { ...payload };
  if (attribution.locale) email.locale = attribution.locale;
  if (attribution.pagePath) email.pagePath = attribution.pagePath;
  if (attribution.serviceLabel) email.serviceLabel = attribution.serviceLabel;
  for (const key of UTM_KEYS) {
    const value = attribution[key];
    if (value) email[key] = value;
  }
  email.subject = buildContactSubject(attribution);
  return email;
}
