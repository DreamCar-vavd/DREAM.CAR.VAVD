import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLeadResponse } from "./deliver";
import { deriveIdempotencyKey, type LeadInput } from "./store";

const input: LeadInput = {
  name: "Оля",
  phone: "+44 7700 900123",
  email: "o@example.com",
  service: "diagnostics",
  vehicle: "",
  message: "коли можна?",
};

test("А — both sinks succeed → 200 ok, no code", () => {
  assert.deepEqual(resolveLeadResponse({ hasStore: true, savedToDb: true, email: "ok" }), {
    status: 200,
    body: { ok: true },
  });
});

test("Б — saved but email failed → 200 ok, SAVED_EMAIL_FAILED (lead is safe in the panel)", () => {
  for (const email of ["failed", "timeout"] as const) {
    assert.deepEqual(resolveLeadResponse({ hasStore: true, savedToDb: true, email }), {
      status: 200,
      body: { ok: true, code: "SAVED_EMAIL_FAILED" },
    });
  }
});

test("В — email ok but DB down → 200 ok, EMAILED_NOT_SAVED (not an atomic op)", () => {
  assert.deepEqual(resolveLeadResponse({ hasStore: true, savedToDb: false, email: "ok" }), {
    status: 200,
    body: { ok: true, code: "EMAILED_NOT_SAVED" },
  });
});

test("Г — both fail → 502 / 504, ok:false", () => {
  assert.deepEqual(resolveLeadResponse({ hasStore: true, savedToDb: false, email: "failed" }), {
    status: 502,
    body: { ok: false, code: "DELIVERY_FAILED" },
  });
  assert.deepEqual(resolveLeadResponse({ hasStore: true, savedToDb: false, email: "timeout" }), {
    status: 504,
    body: { ok: false, code: "UPSTREAM_TIMEOUT" },
  });
});

test("no database configured → behaves exactly like before (no code on success/failure)", () => {
  assert.deepEqual(resolveLeadResponse({ hasStore: false, savedToDb: false, email: "ok" }), {
    status: 200,
    body: { ok: true },
  });
  assert.deepEqual(resolveLeadResponse({ hasStore: false, savedToDb: false, email: "failed" }), {
    status: 502,
    body: { ok: false, code: "DELIVERY_FAILED" },
  });
  assert.deepEqual(resolveLeadResponse({ hasStore: false, savedToDb: false, email: "timeout" }), {
    status: 504,
    body: { ok: false, code: "UPSTREAM_TIMEOUT" },
  });
});

test("Д — an identical retry within the 10-min bucket yields the SAME idempotency key", async () => {
  const t0 = Date.UTC(2026, 8, 7, 12, 0, 0);
  const k1 = await deriveIdempotencyKey(input, t0);
  const k2 = await deriveIdempotencyKey(input, t0 + 4 * 60_000); // 4 min later, same bucket
  assert.equal(k1, k2);
});

test("a genuinely different enquiry, or one >10 min later, gets a DIFFERENT key", async () => {
  const t0 = Date.UTC(2026, 8, 7, 12, 0, 0);
  const base = await deriveIdempotencyKey(input, t0);
  assert.notEqual(await deriveIdempotencyKey({ ...input, message: "інше питання" }, t0), base);
  assert.notEqual(await deriveIdempotencyKey(input, t0 + 11 * 60_000), base);
});

test("idempotency key ignores phone formatting differences", async () => {
  const t0 = Date.UTC(2026, 8, 7, 12, 0, 0);
  assert.equal(
    await deriveIdempotencyKey(input, t0),
    await deriveIdempotencyKey({ ...input, phone: "+447700900123" }, t0),
  );
});
