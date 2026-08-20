import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "./route";

let originalFetch: typeof fetch;
let originalEndpoint: string | undefined;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalEndpoint = process.env.CONTACT_FORM_ENDPOINT;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEndpoint === undefined) {
    delete process.env.CONTACT_FORM_ENDPOINT;
  } else {
    process.env.CONTACT_FORM_ENDPOINT = originalEndpoint;
  }
});

function refusingFetch(): typeof fetch {
  return (async () => {
    throw new Error("fetch must not be called in this scenario");
  }) as typeof fetch;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Test User",
    phone: "+447700900123",
    email: "",
    service: "",
    vehicle: "",
    message: "Hello, this is a test message.",
    consent: true,
    website: "",
    ...overrides,
  };
}

function jsonRequest(body: unknown, headers: Record<string, string> = { "Content-Type": "application/json" }): Request {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function streamFromString(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

test("wrong Content-Type returns 415 UNSUPPORTED_MEDIA_TYPE", async () => {
  const request = jsonRequest(validBody(), { "Content-Type": "text/plain" });
  const response = await POST(request);
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 415);
  assert.equal(json.code, "UNSUPPORTED_MEDIA_TYPE");
});

test("Content-Type with a charset suffix is still accepted", async () => {
  globalThis.fetch = refusingFetch();
  const request = jsonRequest(validBody(), { "Content-Type": "application/json; charset=utf-8" });
  const response = await POST(request);
  assert.notEqual(response.status, 415);
});

test("malformed JSON returns 400 INVALID_PAYLOAD without crashing", async () => {
  const request = jsonRequest("{not valid json");
  const response = await POST(request);
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 400);
  assert.equal(json.code, "INVALID_PAYLOAD");
});

test("invalid data (missing required field) returns 400 INVALID_PAYLOAD", async () => {
  const request = jsonRequest(validBody({ name: "" }));
  const response = await POST(request);
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 400);
  assert.equal(json.code, "INVALID_PAYLOAD");
});

test("a body over 32KB is rejected with 413 (Content-Length present)", async () => {
  const bigBody = validBody({ message: "x".repeat(40_000) });
  const request = jsonRequest(bigBody);
  const response = await POST(request);
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 413);
  assert.equal(json.code, "PAYLOAD_TOO_LARGE");
});

test("a body over 32KB is rejected even without a Content-Length header (streaming enforcement)", async () => {
  const bigJson = JSON.stringify(validBody({ message: "x".repeat(40_000) }));
  const stream = streamFromString(bigJson);
  const request = new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit);

  assert.equal(request.headers.get("content-length"), null, "test setup must not have a Content-Length header");

  const response = await POST(request);
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 413);
  assert.equal(json.code, "PAYLOAD_TOO_LARGE");
});

test("missing CONTACT_FORM_ENDPOINT returns 503 NOT_CONFIGURED", async () => {
  delete process.env.CONTACT_FORM_ENDPOINT;
  globalThis.fetch = refusingFetch();
  const response = await POST(jsonRequest(validBody()));
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 503);
  assert.equal(json.code, "NOT_CONFIGURED");
});

test("an invalid endpoint URL is treated as NOT_CONFIGURED and fetch is never called", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "not a url";
  globalThis.fetch = refusingFetch();
  const response = await POST(jsonRequest(validBody()));
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 503);
  assert.equal(json.code, "NOT_CONFIGURED");
});

test("an http: endpoint is rejected as NOT_CONFIGURED and fetch is never called", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "http://example.com/webhook";
  globalThis.fetch = refusingFetch();
  const response = await POST(jsonRequest(validBody()));
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 503);
  assert.equal(json.code, "NOT_CONFIGURED");
});

test("a filled honeypot returns 200 ok:true and never calls fetch", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = refusingFetch();
  const response = await POST(jsonRequest(validBody({ website: "http://spam.example" })));
  const json = (await response.json()) as { ok: boolean };
  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
});

test("a non-2xx response from the upstream service becomes 502 DELIVERY_FAILED", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = (async () => new Response(null, { status: 500 })) as typeof fetch;
  const response = await POST(jsonRequest(validBody()));
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 502);
  assert.equal(json.code, "DELIVERY_FAILED");
});

test("an AbortError from the upstream fetch becomes 504 UPSTREAM_TIMEOUT", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = (async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    throw abortError;
  }) as typeof fetch;
  const response = await POST(jsonRequest(validBody()));
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 504);
  assert.equal(json.code, "UPSTREAM_TIMEOUT");
});

test("a successful upstream delivery returns 200 ok:true without leaking the upstream body", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ internalId: "secret-123", provider: "acme" }), { status: 200 })) as typeof fetch;
  const response = await POST(jsonRequest(validBody()));
  const json = (await response.json()) as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.deepEqual(json, { ok: true });
});

test("the outgoing request to the provider excludes website and unknown fields", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  let capturedBody: string | null = null;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    capturedBody = typeof init?.body === "string" ? init.body : null;
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  // website must stay empty here: a non-empty value would trigger the
  // honeypot short-circuit and the route would never call fetch at all.
  const response = await POST(
    jsonRequest(
      validBody({
        website: "",
        adminOverride: true,
        extraField: "should be dropped",
      }),
    ),
  );

  assert.equal(response.status, 200);
  assert.ok(capturedBody, "the route must call fetch with a body");
  const forwarded = JSON.parse(capturedBody as unknown as string) as Record<string, unknown>;
  assert.deepEqual(Object.keys(forwarded).sort(), [
    "consent",
    "email",
    "message",
    "name",
    "phone",
    "service",
    "vehicle",
  ]);
  assert.equal("website" in forwarded, false);
  assert.equal("adminOverride" in forwarded, false);
  assert.equal("extraField" in forwarded, false);
  assert.equal(forwarded.consent, true);
});
