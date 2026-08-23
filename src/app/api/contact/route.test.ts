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

test("a Content-Type that merely contains application/json as a substring is rejected", async () => {
  const request = jsonRequest(validBody(), { "Content-Type": "text/application/json" });
  const response = await POST(request);
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 415);
  assert.equal(json.code, "UNSUPPORTED_MEDIA_TYPE");
});

test("a Content-Type that starts with application/json but isn't exactly that is rejected", async () => {
  const request = jsonRequest(validBody(), { "Content-Type": "application/json-fake" });
  const response = await POST(request);
  assert.equal(response.status, 415);
});

test("an empty Content-Type header is rejected", async () => {
  const request = jsonRequest(validBody(), { "Content-Type": "" });
  const response = await POST(request);
  assert.equal(response.status, 415);
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

test("a cross-origin Origin header is rejected with 403 FORBIDDEN_ORIGIN before reaching fetch", async () => {
  globalThis.fetch = refusingFetch();
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  const request = jsonRequest(validBody(), {
    "Content-Type": "application/json",
    Origin: "https://evil.example",
  });
  const response = await POST(request);
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 403);
  assert.equal(json.code, "FORBIDDEN_ORIGIN");
});

test("an Origin header matching the request's own host is allowed through", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
  const request = jsonRequest(validBody(), {
    "Content-Type": "application/json",
    Origin: "http://localhost",
  });
  const response = await POST(request);
  assert.equal(response.status, 200);
});

test("a missing Origin header is allowed through, not blocked", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
  const response = await POST(jsonRequest(validBody()));
  assert.equal(response.status, 200);
});

test("Sec-Fetch-Site: cross-site is rejected even without an Origin header", async () => {
  globalThis.fetch = refusingFetch();
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  const request = jsonRequest(validBody(), {
    "Content-Type": "application/json",
    "Sec-Fetch-Site": "cross-site",
  });
  const response = await POST(request);
  assert.equal(response.status, 403);
});

test("responses are never cacheable", async () => {
  const response = await POST(jsonRequest(validBody({ name: "" })));
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("the upstream fetch refuses to follow redirects (redirect: \"error\")", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    capturedInit = init;
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  const response = await POST(jsonRequest(validBody()));
  assert.equal(response.status, 200);
  assert.equal(capturedInit?.redirect, "error");
});

test("a redirect response from the upstream (redirect: \"error\" throws) becomes 502 DELIVERY_FAILED", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch: redirect mode is 'error'");
  }) as typeof fetch;
  const response = await POST(jsonRequest(validBody()));
  const json = (await response.json()) as { ok: boolean; code: string };
  assert.equal(response.status, 502);
  assert.equal(json.code, "DELIVERY_FAILED");
});

test("the outgoing request asks the upstream provider for a JSON response (Accept: application/json)", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    capturedInit = init;
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  const response = await POST(jsonRequest(validBody()));
  assert.equal(response.status, 200);
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("Accept"), "application/json");
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
