import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTACT_MAX_LENGTHS } from "./contactLimits";
import { UTM_KEYS, extractContactAttribution, isSafePagePath } from "./contactAttribution";

test("a plain locale page yields only its path (no UTM tags present)", () => {
  for (const locale of ["uk", "en", "ru"]) {
    assert.deepEqual(extractContactAttribution(`https://dream-car-vavd.com/${locale}`), {
      pagePath: `/${locale}`,
    });
  }
});

test("all five allowed UTM tags are extracted and trimmed", () => {
  const result = extractContactAttribution(
    "https://dream-car-vavd.com/en?utm_source=google&utm_medium=cpc&utm_campaign=%20london-sourcing%20" +
      "&utm_content=ad-1&utm_term=car+sourcing+london",
  );
  assert.deepEqual(result, {
    pagePath: "/en",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "london-sourcing",
    utm_content: "ad-1",
    utm_term: "car sourcing london",
  });
});

test("unknown query parameters, gclid and fbclid are dropped", () => {
  const result = extractContactAttribution(
    "https://dream-car-vavd.com/uk?utm_source=fb&gclid=abc123&fbclid=xyz789&ref=partner&utm_id=42",
  );
  assert.deepEqual(result, { pagePath: "/uk", utm_source: "fb" });
  assert.equal("gclid" in result, false);
  assert.equal("fbclid" in result, false);
});

test("pagePath never contains the domain, query or hash", () => {
  const result = extractContactAttribution("https://dream-car-vavd.com/ru/cars?utm_source=x&id=1#contacts");
  assert.equal(result.pagePath, "/ru/cars");
});

test("empty UTM values are omitted", () => {
  const result = extractContactAttribution("https://dream-car-vavd.com/uk?utm_source=&utm_medium=%20%20");
  assert.deepEqual(result, { pagePath: "/uk" });
});

test("over-long UTM values and paths are dropped, not truncated", () => {
  const longValue = "a".repeat(CONTACT_MAX_LENGTHS.utm + 1);
  const longPath = `/${"p".repeat(CONTACT_MAX_LENGTHS.pagePath)}`;
  const result = extractContactAttribution(`https://dream-car-vavd.com${longPath}?utm_source=${longValue}&utm_medium=ok`);
  assert.deepEqual(result, { utm_medium: "ok" });
});

test("UTM values with line breaks are dropped", () => {
  const result = extractContactAttribution("https://dream-car-vavd.com/uk?utm_campaign=a%0D%0ABcc:x");
  assert.deepEqual(result, { pagePath: "/uk" });
});

test("an unparsable URL yields no attribution instead of throwing", () => {
  assert.deepEqual(extractContactAttribution("not a url"), {});
});

test("isSafePagePath accepts local paths only", () => {
  assert.equal(isSafePagePath("/uk"), true);
  assert.equal(isSafePagePath("/en/cars/volvo"), true);
  assert.equal(isSafePagePath("uk"), false);
  assert.equal(isSafePagePath("//evil.example"), false);
  assert.equal(isSafePagePath("https://evil.example/"), false);
  assert.equal(isSafePagePath("/uk?x=1"), false);
  assert.equal(isSafePagePath("/uk#top"), false);
  assert.equal(isSafePagePath("/uk\r\nX"), false);
});

test("exactly the five standard UTM keys are allowed", () => {
  assert.deepEqual([...UTM_KEYS], ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);
});
