import { NextResponse } from "next/server";
import {
  isHoneypotTriggered,
  normalizeContactInput,
  readLimitedBody,
  resolveAllowedEndpoint,
  validateContactPayload,
} from "@/lib/contact";

const MAX_BODY_BYTES = 32 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  let bodyResult;
  try {
    bodyResult = await readLimitedBody(request, MAX_BODY_BYTES);
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  if (!bodyResult.ok) {
    return NextResponse.json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }

  const rawBody = bodyResult.text;

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const normalized = normalizeContactInput(parsedBody);

  if (isHoneypotTriggered(normalized)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const validation = validateContactPayload(normalized);
  if (!validation.valid) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const endpoint = resolveAllowedEndpoint(process.env.CONTACT_FORM_ENDPOINT);
  if (!endpoint) {
    return NextResponse.json({ ok: false, code: "NOT_CONFIGURED" }, { status: 503 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validation.payload),
      signal: controller.signal,
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json({ ok: false, code: "DELIVERY_FAILED" }, { status: 502 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ ok: false, code: "UPSTREAM_TIMEOUT" }, { status: 504 });
    }
    return NextResponse.json({ ok: false, code: "DELIVERY_FAILED" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
