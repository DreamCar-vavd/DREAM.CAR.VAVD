import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_MAX_LENGTHS,
  buildContactSubject,
  buildEmailPayload,
  evaluateRequestOrigin,
  isHoneypotTriggered,
  isJsonContentType,
  normalizeContactInput,
  toLeadInput,
  validateContactPayload,
} from "./contact";

// Every key normalizeContactInput returns — anything else is dropped.
const NORMALIZED_KEYS = [
  "consent",
  "email",
  "locale",
  "message",
  "name",
  "pagePath",
  "phone",
  "service",
  "serviceLabel",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
  "vehicle",
  "website",
] as const;

function validRawInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Іван Петренко",
    phone: "+44 7700 900123",
    email: "ivan@example.com",
    service: "car-selection",
    vehicle: "BMW X5, 2019",
    message: "Цікавить підбір автомобіля.",
    consent: true,
    website: "",
    ...overrides,
  };
}

test("valid request passes normalization and validation", () => {
  const normalized = normalizeContactInput(validRawInput());
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, true);
});

test("empty name is rejected", () => {
  const normalized = normalizeContactInput(validRawInput({ name: "   " }));
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, false);
});

test("invalid phone format is rejected", () => {
  const normalized = normalizeContactInput(validRawInput({ phone: "abc" }));
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, false);
});

test("invalid email format is rejected when email is provided", () => {
  const normalized = normalizeContactInput(validRawInput({ email: "not-an-email" }));
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, false);
});

test("empty email is accepted (email is optional)", () => {
  const normalized = normalizeContactInput(validRawInput({ email: "" }));
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, true);
});

test("empty message is rejected", () => {
  const normalized = normalizeContactInput(validRawInput({ message: "   " }));
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, false);
});

test("missing consent is rejected", () => {
  const normalized = normalizeContactInput(validRawInput({ consent: false }));
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, false);
});

test("string fields are trimmed during normalization", () => {
  const normalized = normalizeContactInput(
    validRawInput({ name: "  Іван  ", phone: "  +44 7700 900123  " }),
  );
  assert.equal(normalized.name, "Іван");
  assert.equal(normalized.phone, "+44 7700 900123");
});

const lengthLimitedFields = ["name", "phone", "email", "service", "vehicle", "message"] as const;

for (const field of lengthLimitedFields) {
  test(`${field} exceeding its maximum length (${CONTACT_MAX_LENGTHS[field]}) is rejected`, () => {
    const overLimitValue =
      field === "phone"
        ? `+${"1".repeat(CONTACT_MAX_LENGTHS.phone)}`
        : field === "email"
          ? `${"a".repeat(CONTACT_MAX_LENGTHS.email)}@example.com`
          : "a".repeat(CONTACT_MAX_LENGTHS[field] + 1);
    const normalized = normalizeContactInput(validRawInput({ [field]: overLimitValue }));
    const result = validateContactPayload(normalized);
    assert.equal(result.valid, false, `${field} of length ${overLimitValue.length} should be rejected`);
  });
}

test("a filled honeypot field is detected", () => {
  const normalized = normalizeContactInput(validRawInput({ website: "http://spam.example" }));
  assert.equal(isHoneypotTriggered(normalized), true);
});

test("an empty honeypot field is not flagged as spam", () => {
  const normalized = normalizeContactInput(validRawInput({ website: "" }));
  assert.equal(isHoneypotTriggered(normalized), false);
});

test("unknown fields are dropped during normalization", () => {
  const normalized = normalizeContactInput(
    validRawInput({ adminOverride: true, extra: "unexpected" }),
  );
  const keys = Object.keys(normalized).sort();
  assert.deepEqual(keys, [
    ...NORMALIZED_KEYS,
  ]);
});

test("a __proto__ key coming from parsed JSON does not pollute the result", () => {
  // JSON.parse treats "__proto__" as an ordinary own property key (unlike
  // an object literal, where it would set the prototype instead), so this
  // reproduces what an attacker-controlled request body actually looks like.
  const raw = JSON.parse(
    '{"name":"Іван","phone":"+447700900123","message":"hi","consent":true,"__proto__":{"polluted":true}}',
  ) as unknown;

  const normalized = normalizeContactInput(raw);

  assert.equal((normalized as unknown as Record<string, unknown>).polluted, undefined);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.deepEqual(Object.keys(normalized).sort(), [
    ...NORMALIZED_KEYS,
  ]);
});

test("non-object input normalizes to empty strings without throwing", () => {
  const normalized = normalizeContactInput(null);
  assert.equal(normalized.name, "");
  assert.equal(normalized.consent, false);
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, false);
});

// --- isJsonContentType ---

test("isJsonContentType accepts a bare application/json", () => {
  assert.equal(isJsonContentType("application/json"), true);
});

test("isJsonContentType accepts application/json with a charset parameter", () => {
  assert.equal(isJsonContentType("application/json; charset=utf-8"), true);
});

test("isJsonContentType is case-insensitive", () => {
  assert.equal(isJsonContentType("Application/JSON; Charset=UTF-8"), true);
});

test("isJsonContentType rejects text/application/json", () => {
  assert.equal(isJsonContentType("text/application/json"), false);
});

test("isJsonContentType rejects application/json-fake", () => {
  assert.equal(isJsonContentType("application/json-fake"), false);
});

test("isJsonContentType rejects an empty Content-Type", () => {
  assert.equal(isJsonContentType(""), false);
});

test("isJsonContentType rejects a completely unrelated media type", () => {
  assert.equal(isJsonContentType("text/plain"), false);
});

// --- evaluateRequestOrigin ---

const SITE_ORIGIN = "https://dream-car-vavd.com";

test("evaluateRequestOrigin treats a matching Origin as same-origin", () => {
  assert.equal(evaluateRequestOrigin("https://dream-car-vavd.com", null, SITE_ORIGIN), "same-origin");
});

test("evaluateRequestOrigin treats the Vercel fallback host as same-origin against its own origin", () => {
  assert.equal(
    evaluateRequestOrigin("https://dreamcarvavd.vercel.app", null, "https://dreamcarvavd.vercel.app"),
    "same-origin",
  );
});

test("evaluateRequestOrigin treats a different Origin as cross-origin", () => {
  assert.equal(evaluateRequestOrigin("https://evil.example", null, SITE_ORIGIN), "cross-origin");
});

test("evaluateRequestOrigin treats a malformed Origin header as cross-origin", () => {
  assert.equal(evaluateRequestOrigin("not a url", null, SITE_ORIGIN), "cross-origin");
});

test("evaluateRequestOrigin treats Sec-Fetch-Site: cross-site as cross-origin even without an Origin header", () => {
  assert.equal(evaluateRequestOrigin(null, "cross-site", SITE_ORIGIN), "cross-origin");
});

test("evaluateRequestOrigin treats a matching Origin as same-origin even if Sec-Fetch-Site is missing", () => {
  assert.equal(evaluateRequestOrigin("https://dream-car-vavd.com", null, SITE_ORIGIN), "same-origin");
});

test("evaluateRequestOrigin treats a missing Origin (and no cross-site signal) as unknown, not blocked", () => {
  assert.equal(evaluateRequestOrigin(null, null, SITE_ORIGIN), "unknown");
  assert.equal(evaluateRequestOrigin(null, "same-origin", SITE_ORIGIN), "unknown");
});

// --- attribution metadata (locale, pagePath, serviceLabel, UTM) ---

function validate(overrides: Record<string, unknown> = {}) {
  return validateContactPayload(normalizeContactInput(validRawInput(overrides)));
}

test("an old payload without any attribution is still valid and has empty attribution", () => {
  const result = validate();
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.attribution, {});
  assert.equal(buildContactSubject(result.attribution), "DREAM.CAR.VAVD — New enquiry");
});

for (const locale of ["uk", "en", "ru"]) {
  test(`locale "${locale}" is accepted`, () => {
    const result = validate({ locale });
    assert.equal(result.valid, true);
    if (result.valid) assert.equal(result.attribution.locale, locale);
  });
}

test("an unknown locale is rejected", () => {
  for (const locale of ["de", "UK", "uk-UA", "x"]) {
    assert.equal(validate({ locale }).valid, false, `locale ${locale} should be rejected`);
  }
});

test("pagePath must be a local path without query or hash", () => {
  assert.equal(validate({ pagePath: "/uk" }).valid, true);
  for (const pagePath of ["uk", "//evil.example", "https://evil.example/", "/uk?utm_source=x", "/uk#c", "/uk\nX"]) {
    assert.equal(validate({ pagePath }).valid, false, `pagePath ${JSON.stringify(pagePath)} should be rejected`);
  }
});

test("all five UTM fields pass validation; gclid, fbclid and unknown fields are dropped", () => {
  const result = validate({
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "london",
    utm_content: "ad-1",
    utm_term: "car sourcing",
    gclid: "abc",
    fbclid: "xyz",
    referrer: "https://example.com",
  });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.attribution, {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "london",
    utm_content: "ad-1",
    utm_term: "car sourcing",
  });
});

test("over-long attribution values are rejected", () => {
  const tooLong = "a".repeat(CONTACT_MAX_LENGTHS.utm + 1);
  assert.equal(validate({ utm_campaign: tooLong }).valid, false);
  assert.equal(validate({ pagePath: `/${"p".repeat(CONTACT_MAX_LENGTHS.pagePath)}` }).valid, false);
  assert.equal(validate({ serviceLabel: "a".repeat(CONTACT_MAX_LENGTHS.serviceLabel + 1) }).valid, false);
});

test("a UTM value with CR/LF is rejected", () => {
  assert.equal(validate({ utm_source: "google\r\nBcc: x@example.com" }).valid, false);
});

test("CR/LF in serviceLabel is flattened to a single line", () => {
  const result = validate({ serviceLabel: "Автопідбір\r\nBcc: x@example.com" });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.attribution.serviceLabel, "Автопідбір Bcc: x@example.com");
  assert.equal(/[\r\n]/.test(buildContactSubject(result.attribution)), false);
});

test("serviceLabel is ignored when no service was chosen", () => {
  const result = validate({ service: "", serviceLabel: "Автопідбір" });
  assert.equal(result.valid, true);
  if (result.valid) assert.equal("serviceLabel" in result.attribution, false);
});

test("subject is built in three languages with and without a service", () => {
  assert.equal(buildContactSubject({ locale: "uk", serviceLabel: "Автопідбір" }), "[UK] Автопідбір — нова заявка");
  assert.equal(buildContactSubject({ locale: "en", serviceLabel: "Car sourcing" }), "[EN] Car sourcing — new enquiry");
  assert.equal(buildContactSubject({ locale: "ru", serviceLabel: "Автоподбор" }), "[RU] Автоподбор — новая заявка");
  assert.equal(buildContactSubject({ locale: "uk" }), "[UK] Нова заявка");
  assert.equal(buildContactSubject({ locale: "en" }), "[EN] New enquiry");
  assert.equal(buildContactSubject({ locale: "ru" }), "[RU] Новая заявка");
  assert.equal(buildContactSubject({}), "DREAM.CAR.VAVD — New enquiry");
});

test("subject never exceeds its maximum length", () => {
  const subject = buildContactSubject({ locale: "uk", serviceLabel: "a".repeat(CONTACT_MAX_LENGTHS.serviceLabel) });
  assert.ok(subject.length <= CONTACT_MAX_LENGTHS.subject);
});

test("a subject sent by the browser is ignored", () => {
  const normalized = normalizeContactInput(validRawInput({ locale: "en", subject: "Injected" }));
  assert.equal("subject" in normalized, false);
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(buildEmailPayload(result.payload, result.attribution).subject, "[EN] New enquiry");
});

test("the email payload carries the lead, non-empty attribution and the subject only", () => {
  const result = validate({ locale: "uk", pagePath: "/uk", serviceLabel: "Автопідбір", utm_source: "google", utm_term: "" });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  const email = buildEmailPayload(result.payload, result.attribution);
  assert.deepEqual(Object.keys(email).sort(), [
    "consent",
    "email",
    "locale",
    "message",
    "name",
    "pagePath",
    "phone",
    "service",
    "serviceLabel",
    "subject",
    "utm_source",
    "vehicle",
  ]);
  assert.equal(email.service, "car-selection");
  assert.equal(email.subject, "[UK] Автопідбір — нова заявка");
});

test("the database input contains only the original lead fields", () => {
  const result = validate({ locale: "ru", pagePath: "/ru", serviceLabel: "Автоподбор", utm_source: "google" });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(Object.keys(toLeadInput(result.payload)).sort(), [
    "email",
    "message",
    "name",
    "phone",
    "service",
    "vehicle",
  ]);
});
