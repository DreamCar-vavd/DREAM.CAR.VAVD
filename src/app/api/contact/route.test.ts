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
    "subject",
    "vehicle",
  ]);
  // An old payload without attribution still gets a safe, generic subject.
  assert.equal(forwarded.subject, "DREAM.CAR.VAVD — New enquiry");
  assert.equal("website" in forwarded, false);
  assert.equal("adminOverride" in forwarded, false);
  assert.equal("extraField" in forwarded, false);
  assert.equal(forwarded.consent, true);
});

// --- attribution metadata ---

function capturingFetch(): { fetch: typeof fetch; bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = [];
  const fn = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  return { fetch: fn, bodies };
}

test("attribution, serviceLabel and a server-built subject reach the provider; gclid/fbclid/unknown fields do not", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  const captured = capturingFetch();
  globalThis.fetch = captured.fetch;

  const response = await POST(
    jsonRequest(
      validBody({
        service: "car-selection",
        locale: "uk",
        pagePath: "/uk",
        serviceLabel: "Автопідбір",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "london",
        utm_content: "ad-1",
        utm_term: "car sourcing",
        gclid: "abc",
        fbclid: "xyz",
        subject: "Injected subject",
      }),
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const [forwarded] = captured.bodies;
  assert.deepEqual(Object.keys(forwarded).sort(), [
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
    "utm_campaign",
    "utm_content",
    "utm_medium",
    "utm_source",
    "utm_term",
    "vehicle",
  ]);
  assert.equal(forwarded.service, "car-selection");
  assert.equal(forwarded.serviceLabel, "Автопідбір");
  assert.equal(forwarded.subject, "[UK] Автопідбір — нова заявка");
});

test("empty UTM fields are not forwarded", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  const captured = capturingFetch();
  globalThis.fetch = captured.fetch;

  const response = await POST(jsonRequest(validBody({ locale: "en", pagePath: "/en", utm_source: "", utm_term: "  " })));

  assert.equal(response.status, 200);
  const [forwarded] = captured.bodies;
  assert.equal(Object.keys(forwarded).some((key) => key.startsWith("utm_")), false);
  assert.equal(forwarded.subject, "[EN] New enquiry");
});

test("subjects are built in all three languages", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  const cases = [
    { locale: "uk", serviceLabel: "Автопідбір", subject: "[UK] Автопідбір — нова заявка" },
    { locale: "en", serviceLabel: "Car sourcing", subject: "[EN] Car sourcing — new enquiry" },
    { locale: "ru", serviceLabel: "Автоподбор", subject: "[RU] Автоподбор — новая заявка" },
  ];
  for (const c of cases) {
    const captured = capturingFetch();
    globalThis.fetch = captured.fetch;
    const response = await POST(
      jsonRequest(validBody({ service: "car-selection", locale: c.locale, serviceLabel: c.serviceLabel })),
    );
    assert.equal(response.status, 200);
    assert.equal(captured.bodies[0].subject, c.subject);
  }
});

test("an invalid locale or an over-long UTM value is rejected with 400 before reaching fetch", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = refusingFetch();

  for (const extra of [{ locale: "de" }, { utm_campaign: "a".repeat(101) }, { pagePath: "https://evil.example/" }]) {
    const response = await POST(jsonRequest(validBody(extra)));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, code: "INVALID_PAYLOAD" });
  }
});

test("CR/LF in serviceLabel never reaches the email subject", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  const captured = capturingFetch();
  globalThis.fetch = captured.fetch;

  const response = await POST(
    jsonRequest(validBody({ service: "car-selection", locale: "en", serviceLabel: "Car sourcing\r\nBcc: x@example.com" })),
  );

  assert.equal(response.status, 200);
  const subject = String(captured.bodies[0].subject);
  assert.equal(/[\r\n]/.test(subject), false);
  assert.equal(String(captured.bodies[0].serviceLabel).includes("\n"), false);
});

test("a filled honeypot with attribution still never calls fetch", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = refusingFetch();

  const response = await POST(jsonRequest(validBody({ website: "spam", locale: "uk", utm_source: "x" })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("attribution does not change upstream failure handling", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = (async () => new Response(null, { status: 500 })) as typeof fetch;

  const response = await POST(jsonRequest(validBody({ locale: "ru", pagePath: "/ru", utm_source: "google" })));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, code: "DELIVERY_FAILED" });
});

// --- per-IP rate limit ---
// The route uses one module-level limiter, so every test below uses its own
// IP addresses (RFC 5737 documentation ranges) to stay independent.

function ipRequest(ip: string | null, body: unknown = validBody()): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ip) headers["x-vercel-forwarded-for"] = ip;
  return jsonRequest(body, headers);
}

function countingFetch(): { fetch: typeof fetch; calls: () => number } {
  let calls = 0;
  const fn = (async () => {
    calls += 1;
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  return { fetch: fn, calls: () => calls };
}

test("rate limit: 5 valid submissions per IP are delivered, the 6th gets 429 and never reaches the provider", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  const counter = countingFetch();
  globalThis.fetch = counter.fetch;

  for (let i = 1; i <= 5; i++) {
    const response = await POST(ipRequest("192.0.2.11"));
    assert.equal(response.status, 200, `submission ${i}`);
  }
  assert.equal(counter.calls(), 5);

  const blocked = await POST(ipRequest("192.0.2.11"));
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { ok: false, code: "RATE_LIMITED" });
  assert.equal(blocked.headers.get("Cache-Control"), "no-store");
  const retryAfter = Number(blocked.headers.get("Retry-After"));
  assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 60, `Retry-After=${retryAfter}`);
  assert.equal(counter.calls(), 5, "the blocked submission must not call the provider");
});

test("rate limit: another IP is still allowed while one IP is blocked", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = countingFetch().fetch;

  for (let i = 0; i < 5; i++) await POST(ipRequest("192.0.2.21"));
  assert.equal((await POST(ipRequest("192.0.2.21"))).status, 429);
  assert.equal((await POST(ipRequest("192.0.2.22"))).status, 200);
});

test("rate limit: the x-forwarded-for fallback is limited the same way (first address only)", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = countingFetch().fetch;
  const forwarded = (first: string) =>
    jsonRequest(validBody(), { "Content-Type": "application/json", "x-forwarded-for": `${first}, 10.0.0.1` });

  for (let i = 0; i < 5; i++) assert.equal((await POST(forwarded("192.0.2.31"))).status, 200);
  assert.equal((await POST(forwarded("192.0.2.31"))).status, 429);
  // Same proxy hop, different client: not blocked.
  assert.equal((await POST(forwarded("192.0.2.32"))).status, 200);
});

test("rate limit: allowed again after 60 seconds (mocked clock, no real waiting)", async (t) => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = countingFetch().fetch;
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });

  for (let i = 0; i < 5; i++) await POST(ipRequest("192.0.2.41"));
  assert.equal((await POST(ipRequest("192.0.2.41"))).status, 429);

  t.mock.timers.tick(59_999);
  assert.equal((await POST(ipRequest("192.0.2.41"))).status, 429);

  t.mock.timers.tick(1);
  assert.equal((await POST(ipRequest("192.0.2.41"))).status, 200);
});

test("rate limit: requests without any client IP are never blocked (fail-open)", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  const counter = countingFetch();
  globalThis.fetch = counter.fetch;

  for (let i = 0; i < 8; i++) {
    assert.equal((await POST(ipRequest(null))).status, 200, `submission ${i + 1}`);
  }
  assert.equal(counter.calls(), 8);
});

test("rate limit: honeypot hits and invalid payloads do not use up the limit", async () => {
  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  globalThis.fetch = countingFetch().fetch;

  for (let i = 0; i < 10; i++) {
    assert.equal((await POST(ipRequest("192.0.2.51", validBody({ website: "spam" })))).status, 200);
    assert.equal((await POST(ipRequest("192.0.2.51", validBody({ message: "" })))).status, 400);
  }
  for (let i = 1; i <= 5; i++) {
    assert.equal((await POST(ipRequest("192.0.2.51"))).status, 200, `valid submission ${i}`);
  }
  assert.equal((await POST(ipRequest("192.0.2.51"))).status, 429);
});

test("rate limit: a blocked submission never reaches the leads database or the provider", async (t) => {
  // A fresh copy of the route with the leads store mocked, so database
  // writes can be counted. The rate limiter module is shared (same cache).
  let dbWrites = 0;
  t.mock.module(new URL("../../../lib/leads/store.ts", import.meta.url).href, {
    namedExports: {
      getWritableLeadsStore: async () => ({
        kind: "database",
        create: async () => {
          dbWrites += 1;
          return { id: String(dbWrites), inserted: true };
        },
      }),
      deriveIdempotencyKeys: async () => ({ current: "c", previous: "p" }),
    },
  });
  const { POST: mockedPost } = (await import(`./route.ts?db-mock=${Date.now()}`)) as typeof import("./route");

  process.env.CONTACT_FORM_ENDPOINT = "https://example.com/webhook";
  const counter = countingFetch();
  globalThis.fetch = counter.fetch;

  for (let i = 0; i < 5; i++) assert.equal((await mockedPost(ipRequest("192.0.2.61"))).status, 200);
  assert.equal(dbWrites, 5);
  assert.equal(counter.calls(), 5);

  const blocked = await mockedPost(ipRequest("192.0.2.61"));
  assert.equal(blocked.status, 429);
  assert.equal(dbWrites, 5, "the blocked submission must not be written to the database");
  assert.equal(counter.calls(), 5, "the blocked submission must not call the provider");
});
