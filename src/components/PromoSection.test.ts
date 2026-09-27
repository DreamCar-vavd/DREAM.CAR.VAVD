import { test } from "node:test";
import assert from "node:assert/strict";
import { promoGridClass } from "./PromoSection";

test("one promo card: a single centred column with a max width", () => {
  const c = promoGridClass(1);
  assert.match(c, /\bmx-auto\b/);
  assert.match(c, /\bmax-w-sm\b/);
  assert.doesNotMatch(c, /grid-cols-/);
});

test("two promo cards: two centred columns from sm", () => {
  const c = promoGridClass(2);
  assert.match(c, /\bmx-auto\b/);
  assert.match(c, /\bmax-w-3xl\b/);
  assert.match(c, /\bsm:grid-cols-2\b/);
  assert.doesNotMatch(c, /lg:grid-cols-3/);
});

test("three or more promo cards keep the existing responsive grid", () => {
  for (const n of [3, 4, 7]) {
    assert.equal(promoGridClass(n), "mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3");
  }
});

test("mobile stays one column: no variant sets columns below sm", () => {
  for (const n of [1, 2, 3, 4]) {
    assert.doesNotMatch(promoGridClass(n), /(^|\s)grid-cols-/);
  }
});
