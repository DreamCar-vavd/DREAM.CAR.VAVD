import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CONTACT_RATE_LIMIT, createContactRateLimiter, getClientIp } from "./contactRateLimit";

const T0 = 1_760_000_000_000;

test("the first 5 requests from one IP are allowed and the 6th is blocked", () => {
  const limiter = createContactRateLimiter();
  for (let i = 0; i < CONTACT_RATE_LIMIT.maxRequests; i++) {
    assert.deepEqual(limiter.check("203.0.113.7", T0 + i * 1000), { allowed: true }, `request ${i + 1}`);
  }
  const blocked = limiter.check("203.0.113.7", T0 + 5000);
  assert.equal(blocked.allowed, false);
});

test("Retry-After counts down to when the oldest request leaves the window", () => {
  const limiter = createContactRateLimiter();
  for (let i = 0; i < 5; i++) limiter.check("203.0.113.7", T0);
  assert.deepEqual(limiter.check("203.0.113.7", T0 + 1), { allowed: false, retryAfterSeconds: 60 });
  assert.deepEqual(limiter.check("203.0.113.7", T0 + 45_500), { allowed: false, retryAfterSeconds: 15 });
  assert.deepEqual(limiter.check("203.0.113.7", T0 + 59_999), { allowed: false, retryAfterSeconds: 1 });
});

test("another IP is not affected", () => {
  const limiter = createContactRateLimiter();
  for (let i = 0; i < 5; i++) limiter.check("203.0.113.7", T0);
  assert.equal(limiter.check("203.0.113.7", T0).allowed, false);
  assert.equal(limiter.check("198.51.100.20", T0).allowed, true);
});

test("a request is allowed again once 60 seconds have passed (no real waiting)", () => {
  const limiter = createContactRateLimiter();
  for (let i = 0; i < 5; i++) limiter.check("203.0.113.7", T0);
  assert.equal(limiter.check("203.0.113.7", T0 + CONTACT_RATE_LIMIT.windowMs - 1).allowed, false);
  assert.equal(limiter.check("203.0.113.7", T0 + CONTACT_RATE_LIMIT.windowMs).allowed, true);
});

test("blocked requests do not extend the block", () => {
  const limiter = createContactRateLimiter();
  for (let i = 0; i < 5; i++) limiter.check("203.0.113.7", T0);
  for (let i = 1; i <= 10; i++) limiter.check("203.0.113.7", T0 + i * 1000);
  assert.equal(limiter.check("203.0.113.7", T0 + 60_000).allowed, true);
});

test("expired hashes are removed on the next check, even far below maxKeys", () => {
  const limiter = createContactRateLimiter();
  limiter.check("203.0.113.7", T0);
  limiter.check("198.51.100.20", T0 + 1000);
  assert.equal(limiter.keys().length, 2);
  limiter.check("192.0.2.1", T0 + 60_000);
  // 203.0.113.7 expired at T0+60s and is gone; 198.51.100.20 is still live.
  assert.equal(limiter.keys().length, 2);
  limiter.check("192.0.2.1", T0 + 61_000);
  assert.deepEqual(limiter.keys(), [createHash("sha256").update("192.0.2.1").digest("hex")]);
});

test("a missing IP fails open and is never stored", () => {
  const limiter = createContactRateLimiter();
  for (let i = 0; i < 20; i++) assert.equal(limiter.check(null, T0).allowed, true);
  assert.equal(limiter.keys().length, 0);
});

test("only a SHA-256 of the IP is kept in memory", () => {
  const limiter = createContactRateLimiter();
  limiter.check("203.0.113.7", T0);
  const keys = limiter.keys();
  assert.equal(keys.length, 1);
  assert.equal(keys[0], createHash("sha256").update("203.0.113.7").digest("hex"));
  assert.equal(keys[0].includes("203.0.113.7"), false);
});

test("memory stays bounded: expired keys are pruned and the oldest key is evicted", () => {
  const limiter = createContactRateLimiter({ maxRequests: 5, windowMs: 60_000, maxKeys: 3 });
  limiter.check("10.0.0.1", T0);
  limiter.check("10.0.0.2", T0);
  limiter.check("10.0.0.3", T0);
  assert.equal(limiter.keys().length, 3);

  // All three expired -> pruned instead of growing.
  limiter.check("10.0.0.4", T0 + 60_000);
  assert.equal(limiter.keys().length, 1);

  // Full of live keys -> the least recently used one is evicted.
  limiter.check("10.0.0.5", T0 + 60_001);
  limiter.check("10.0.0.6", T0 + 60_002);
  limiter.check("10.0.0.7", T0 + 60_003);
  assert.equal(limiter.keys().length, 3);
});

function headers(init: Record<string, string>) {
  return new Headers(init);
}

test("getClientIp prefers x-vercel-forwarded-for and takes only the first address", () => {
  assert.equal(
    getClientIp(headers({ "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1", "x-forwarded-for": "198.51.100.1" })),
    "203.0.113.7",
  );
});

test("getClientIp falls back to x-forwarded-for", () => {
  assert.equal(getClientIp(headers({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1" })), "198.51.100.1");
});

test("getClientIp normalizes IPv6, IPv4-mapped IPv6 and ports", () => {
  assert.equal(getClientIp(headers({ "x-forwarded-for": "2001:DB8::1" })), "2001:db8::1");
  assert.equal(getClientIp(headers({ "x-forwarded-for": "[2001:db8::1]:443" })), "2001:db8::1");
  assert.equal(getClientIp(headers({ "x-forwarded-for": "::ffff:203.0.113.7" })), "203.0.113.7");
  assert.equal(getClientIp(headers({ "x-forwarded-for": "203.0.113.7:51234" })), "203.0.113.7");
});

test("getClientIp returns null for a missing or garbage header", () => {
  assert.equal(getClientIp(headers({})), null);
  assert.equal(getClientIp(headers({ "x-forwarded-for": "unknown" })), null);
  assert.equal(getClientIp(headers({ "x-vercel-forwarded-for": "not-an-ip", "x-forwarded-for": "" })), null);
});

test("getClientIp skips an invalid x-vercel-forwarded-for and uses a valid x-forwarded-for", () => {
  assert.equal(
    getClientIp(headers({ "x-vercel-forwarded-for": "garbage", "x-forwarded-for": "198.51.100.1" })),
    "198.51.100.1",
  );
});
