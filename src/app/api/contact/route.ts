import { NextResponse } from "next/server";
import {
  evaluateRequestOrigin,
  isHoneypotTriggered,
  isJsonContentType,
  normalizeContactInput,
  readLimitedBody,
  resolveAllowedEndpoint,
  validateContactPayload,
} from "@/lib/contact";

const MAX_BODY_BYTES = 32 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;

// Every response from this route carries user-facing, non-idempotent
// submission state (success/error/rate-limited) — it must never be served
// from a cache to a different visitor or a later request.
function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const siteOrigin = new URL(request.url).origin;
  const originCheck = evaluateRequestOrigin(
    request.headers.get("origin"),
    request.headers.get("sec-fetch-site"),
    siteOrigin,
  );
  if (originCheck === "cross-origin") {
    return jsonResponse({ ok: false, code: "FORBIDDEN_ORIGIN" }, 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!isJsonContentType(contentType)) {
    return jsonResponse({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  }

  let bodyResult;
  try {
    bodyResult = await readLimitedBody(request, MAX_BODY_BYTES);
  } catch {
    return jsonResponse({ ok: false, code: "INVALID_PAYLOAD" }, 400);
  }

  if (!bodyResult.ok) {
    return jsonResponse({ ok: false, code: "PAYLOAD_TOO_LARGE" }, 413);
  }

  const rawBody = bodyResult.text;

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, code: "INVALID_PAYLOAD" }, 400);
  }

  const normalized = normalizeContactInput(parsedBody);

  if (isHoneypotTriggered(normalized)) {
    return jsonResponse({ ok: true }, 200);
  }

  const validation = validateContactPayload(normalized);
  if (!validation.valid) {
    return jsonResponse({ ok: false, code: "INVALID_PAYLOAD" }, 400);
  }

  const endpoint = resolveAllowedEndpoint(process.env.CONTACT_FORM_ENDPOINT);
  if (!endpoint) {
    return jsonResponse({ ok: false, code: "NOT_CONFIGURED" }, 503);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      // `Accept: application/json` asks the upstream provider (Formspree)
      // for its AJAX-style JSON response instead of the default
      // browser-form behavior of a 302 redirect to a thank-you page —
      // which would otherwise conflict with `redirect: "error"` below
      // and turn a successful submission into a reported failure.
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(validation.payload),
      signal: controller.signal,
      // Never silently follow a redirect away from the configured
      // endpoint: if it ever redirected (misconfiguration or a
      // compromised provider), following it would forward the visitor's
      // contact details to an unverified URL. Fail loud instead.
      redirect: "error",
    });

    if (!upstreamResponse.ok) {
      return jsonResponse({ ok: false, code: "DELIVERY_FAILED" }, 502);
    }

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return jsonResponse({ ok: false, code: "UPSTREAM_TIMEOUT" }, 504);
    }
    return jsonResponse({ ok: false, code: "DELIVERY_FAILED" }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}
