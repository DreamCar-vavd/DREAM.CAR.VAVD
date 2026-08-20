const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s()-]{6,}$/;

export const CONTACT_MAX_LENGTHS = {
  name: 100,
  phone: 30,
  email: 254,
  service: 100,
  vehicle: 200,
  message: 5000,
} as const;

export interface NormalizedContactInput {
  name: string;
  phone: string;
  email: string;
  service: string;
  vehicle: string;
  message: string;
  consent: boolean;
  website: string;
}

export interface ContactPayload {
  name: string;
  phone: string;
  email: string;
  service: string;
  vehicle: string;
  message: string;
  consent: true;
}

export type ContactValidationResult =
  | { valid: true; payload: ContactPayload }
  | { valid: false; reason: string };

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type ReadLimitedBodyResult = { ok: true; text: string } | { ok: false; reason: "too_large" };

/**
 * Reads a Request body up to `maxBytes` without ever buffering more than
 * that limit in memory. Cancels the stream as soon as the limit is
 * exceeded instead of reading the whole body first and checking after.
 */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<ReadLimitedBodyResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  const body = request.body;
  if (!body) {
    return { ok: true, text: "" };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(combined) };
}

/**
 * Validates a server-configured delivery endpoint. Only a well-formed
 * `https:` URL is accepted; anything empty, malformed, or on another
 * protocol is treated as "not configured".
 */
export function resolveAllowedEndpoint(rawValue: string | undefined): URL | null {
  if (!rawValue) return null;
  try {
    const parsed = new URL(rawValue);
    return parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Extracts only the known contact-form fields from an arbitrary parsed JSON
 * body. Anything else in the input is discarded.
 */
export function normalizeContactInput(raw: unknown): NormalizedContactInput {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    name: readString(source.name),
    phone: readString(source.phone),
    email: readString(source.email),
    service: readString(source.service),
    vehicle: readString(source.vehicle),
    message: readString(source.message),
    consent: source.consent === true,
    website: readString(source.website),
  };
}

export function isHoneypotTriggered(input: NormalizedContactInput): boolean {
  return input.website.length > 0;
}

export function validateContactPayload(input: NormalizedContactInput): ContactValidationResult {
  if (!input.name) return { valid: false, reason: "name is required" };
  if (input.name.length > CONTACT_MAX_LENGTHS.name) return { valid: false, reason: "name too long" };

  if (!input.phone) return { valid: false, reason: "phone is required" };
  if (input.phone.length > CONTACT_MAX_LENGTHS.phone) return { valid: false, reason: "phone too long" };
  if (!PHONE_PATTERN.test(input.phone)) return { valid: false, reason: "phone is invalid" };

  if (input.email) {
    if (input.email.length > CONTACT_MAX_LENGTHS.email) return { valid: false, reason: "email too long" };
    if (!EMAIL_PATTERN.test(input.email)) return { valid: false, reason: "email is invalid" };
  }

  if (input.service.length > CONTACT_MAX_LENGTHS.service) {
    return { valid: false, reason: "service too long" };
  }

  if (input.vehicle.length > CONTACT_MAX_LENGTHS.vehicle) {
    return { valid: false, reason: "vehicle too long" };
  }

  if (!input.message) return { valid: false, reason: "message is required" };
  if (input.message.length > CONTACT_MAX_LENGTHS.message) {
    return { valid: false, reason: "message too long" };
  }

  if (input.consent !== true) return { valid: false, reason: "consent is required" };

  return {
    valid: true,
    payload: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      service: input.service,
      vehicle: input.vehicle,
      message: input.message,
      consent: true,
    },
  };
}
