import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_MAX_LENGTHS,
  isHoneypotTriggered,
  normalizeContactInput,
  validateContactPayload,
} from "./contact";

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
    "consent",
    "email",
    "message",
    "name",
    "phone",
    "service",
    "vehicle",
    "website",
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
    "consent",
    "email",
    "message",
    "name",
    "phone",
    "service",
    "vehicle",
    "website",
  ]);
});

test("non-object input normalizes to empty strings without throwing", () => {
  const normalized = normalizeContactInput(null);
  assert.equal(normalized.name, "");
  assert.equal(normalized.consent, false);
  const result = validateContactPayload(normalized);
  assert.equal(result.valid, false);
});
