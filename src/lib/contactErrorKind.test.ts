import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyContactErrorKind } from "./contactErrorKind";

test("classifyContactErrorKind maps a 429 status to rateLimited regardless of code", () => {
  assert.equal(classifyContactErrorKind(429, undefined), "rateLimited");
  assert.equal(classifyContactErrorKind(429, null), "rateLimited");
  assert.equal(classifyContactErrorKind(429, "SOMETHING_ELSE"), "rateLimited");
});

test("classifyContactErrorKind maps NOT_CONFIGURED to notConfigured", () => {
  assert.equal(classifyContactErrorKind(503, "NOT_CONFIGURED"), "notConfigured");
});

test("classifyContactErrorKind maps UPSTREAM_TIMEOUT to timeout", () => {
  assert.equal(classifyContactErrorKind(504, "UPSTREAM_TIMEOUT"), "timeout");
});

test("classifyContactErrorKind falls back to generic for an unrecognized code", () => {
  assert.equal(classifyContactErrorKind(502, "DELIVERY_FAILED"), "generic");
});

test("classifyContactErrorKind falls back to generic when there is no code at all (HTML or empty body)", () => {
  assert.equal(classifyContactErrorKind(500, null), "generic");
  assert.equal(classifyContactErrorKind(500, undefined), "generic");
});
