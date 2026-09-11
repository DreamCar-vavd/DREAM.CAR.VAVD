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
import { getWritableLeadsStore, deriveIdempotencyKeys, type LeadInput } from "@/lib/leads/store";
import { resolveLeadResponse, type EmailOutcome } from "@/lib/leads/deliver";

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

  // Durable record (panel database) — an INDEPENDENT sink, tried BEFORE email
  // so a captured lead survives an email outage or a missing email endpoint.
  // `null` when no database is configured -> no-op, the email path is exactly
  // as before. Never throws out of here, never logs personal data.
  const leadsStore = await getWritableLeadsStore();
  let savedToDb = false;
  if (leadsStore) {
    try {
      const keys = await deriveIdempotencyKeys(validation.payload as LeadInput);
      await leadsStore.create(validation.payload as LeadInput, keys);
      savedToDb = true;
    } catch {
      console.warn("[contact] lead DB write failed; continuing with email only");
    }
  }

  const endpoint = resolveAllowedEndpoint(process.env.CONTACT_FORM_ENDPOINT);
  if (!endpoint) {
    // Email not set up. If the lead was still saved, report success with a
    // code; otherwise keep the original 503.
    return savedToDb
      ? jsonResponse({ ok: true, code: "SAVED_EMAIL_FAILED" }, 200)
      : jsonResponse({ ok: false, code: "NOT_CONFIGURED" }, 503);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  let email: EmailOutcome;
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
    email = upstreamResponse.ok ? "ok" : "failed";
  } catch (error) {
    email = error instanceof Error && error.name === "AbortError" ? "timeout" : "failed";
  } finally {
    clearTimeout(timeoutId);
  }

  const { status, body } = resolveLeadResponse({ hasStore: Boolean(leadsStore), savedToDb, email });
  return jsonResponse(body, status);
}
