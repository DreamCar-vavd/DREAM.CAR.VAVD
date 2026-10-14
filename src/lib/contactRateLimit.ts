import { createHash } from "node:crypto";
import { isIP } from "node:net";

/**
 * Per-IP limit on accepted contact-form submissions, so one bot or visitor
 * cannot burn through the monthly email-provider quota.
 *
 * Scope and limits (deliberate):
 * - in-memory, per function instance: it resets on a cold start or a new
 *   deployment and is not shared between instances. It is a cheap extra
 *   guard on top of the Vercel WAF rule, not a replacement for it;
 * - raw IPs are never stored or logged — only a SHA-256 of the address is
 *   kept, for at most one window;
 * - fail-open: a request without a usable IP is never limited, so a missing
 *   header can't block every visitor;
 * - bounded memory: expired entries are pruned on every check (no timers),
 *   and the oldest key is evicted once `maxKeys` is reached.
 */
export const CONTACT_RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 60_000,
  maxKeys: 5_000,
} as const;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface ContactRateLimiter {
  /** Records the request when allowed; a blocked request does not count. */
  check(ip: string | null, now?: number): RateLimitResult;
  /** The keys currently held — SHA-256 hex digests, never raw IPs (for tests). */
  keys(): string[];
}

/**
 * The client IP from Vercel's request headers: `x-vercel-forwarded-for`
 * first, `x-forwarded-for` as a fallback (Vercel overwrites it, so a client
 * can't spoof it there). Only the first address of the list is used, and
 * only if it parses as a real IPv4/IPv6 address.
 */
export function getClientIp(headers: Headers): string | null {
  for (const name of ["x-vercel-forwarded-for", "x-forwarded-for"]) {
    const raw = headers.get(name);
    if (!raw) continue;
    const ip = normalizeIp(raw.split(",")[0] ?? "");
    if (ip) return ip;
  }
  return null;
}

function normalizeIp(value: string): string | null {
  let ip = value.trim();
  // "[2001:db8::1]:443" -> "2001:db8::1"; "203.0.113.7:443" -> "203.0.113.7"
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed) ip = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));

  const version = isIP(ip);
  if (version === 4) return ip;
  if (version === 6) {
    const lower = ip.toLowerCase();
    // An IPv4-mapped IPv6 address is the same client as the plain IPv4 one.
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
    return mapped && isIP(mapped[1]) === 4 ? mapped[1] : lower;
  }
  return null;
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export function createContactRateLimiter(
  options: { maxRequests: number; windowMs: number; maxKeys: number } = CONTACT_RATE_LIMIT,
): ContactRateLimiter {
  // key -> timestamps of accepted requests inside the window (oldest first).
  // Map iteration order is insertion order; a key is re-inserted on every
  // accepted request, so the first key is always the least recently used.
  const hits = new Map<string, number[]>();

  function pruneExpired(now: number) {
    for (const [key, times] of hits) {
      if (now - times[times.length - 1] >= options.windowMs) hits.delete(key);
    }
  }

  return {
    check(ip, now = Date.now()) {
      if (!ip) return { allowed: true };

      pruneExpired(now);
      const key = hashIp(ip);
      const recent = (hits.get(key) ?? []).filter((t) => now - t < options.windowMs);

      if (recent.length >= options.maxRequests) {
        hits.set(key, recent);
        const retryAfterMs = recent[0] + options.windowMs - now;
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      }

      hits.delete(key);
      while (hits.size >= options.maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest === undefined) break;
        hits.delete(oldest);
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true };
    },
    keys() {
      return [...hits.keys()];
    },
  };
}

/** The limiter used by `/api/contact`. */
export const contactRateLimiter = createContactRateLimiter();
