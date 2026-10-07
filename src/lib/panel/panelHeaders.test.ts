import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../../next.config";

const PANEL_SOURCES = ["/keystatic/:path*", "/api/keystatic/:path*", "/panel/:path*", "/api/panel/:path*"];

test("panel and Keystatic routes are noindex and keep their CSP; the public rule is untouched", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  for (const source of PANEL_SOURCES) {
    const rule = rules.find((r) => r.source === source);
    assert.ok(rule, source);
    assert.deepEqual(
      rule.headers.find((h) => h.key === "X-Robots-Tag"),
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      source,
    );
    assert.ok(rule.headers.some((h) => h.key === "Content-Security-Policy"), source);
  }
  const publicRules = rules.filter((r) => !PANEL_SOURCES.includes(r.source));
  assert.ok(publicRules.length > 0);
  for (const rule of publicRules) {
    assert.equal(rule.headers.some((h) => h.key === "X-Robots-Tag"), false, rule.source);
  }
});
